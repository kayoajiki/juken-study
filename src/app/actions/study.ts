"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, studySessions, users } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";
import { recordStudySessionDb } from "@/lib/record-session";
import { rawPointsForSession } from "@/lib/points-rank";
import { tokyoYmd } from "@/lib/tokyo-date";
import type { SubjectId } from "@/lib/subjects";
import type { EarnedBadge } from "@/lib/badges";
import type { RankDef } from "@/lib/points-rank";

export async function recordStudySessionAction(input: {
  subject: SubjectId;
  kind: "homework" | "self_study";
  minutes: number;
  startedAtIso: string;
  endedAtIso: string;
}): Promise<
  | { ok: true; awarded: number; newBadges: EarnedBadge[]; prevRank: RankDef; newRank: RankDef }
  | { ok: false; error: string }
> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "ログインが必要です" };
  try {
    const { awarded, newBadges, prevRank, newRank } = await recordStudySessionDb(getDb(), userId, {
      subject: input.subject,
      kind: input.kind,
      minutes: input.minutes,
      startedAt: new Date(input.startedAtIso),
      endedAt: new Date(input.endedAtIso),
    });
    return { ok: true, awarded, newBadges, prevRank, newRank };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "保存に失敗しました" };
  }
}

export async function deleteStudySessionAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };

  const db = getDb();

  const [del] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .limit(1);
  if (!del) return { ok: false, error: "セッションが見つかりません" };

  await db
    .delete(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)));

  // Recalculate stats from remaining sessions
  const remaining = await db
    .select({ minutes: studySessions.minutes, startedAt: studySessions.startedAt, kind: studySessions.kind })
    .from(studySessions)
    .where(eq(studySessions.userId, userId));

  const newTotalMinutes = remaining.reduce((s, r) => s + r.minutes, 0);

  const [profile] = await db
    .select({ totalPoints: users.totalPoints, monthlyPoints: users.monthlyPoints, monthlySeason: users.monthlySeason })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) return { ok: true };

  const rawDel = rawPointsForSession(del.minutes, del.kind as "homework" | "self_study");
  const currentSeason = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
  }).format(new Date()).slice(0, 7);
  const sessionSeason = del.startedAt.slice(0, 7);

  const newTotalPoints = Math.max(0, (profile.totalPoints ?? 0) - rawDel);
  let newMonthlyPoints = profile.monthlyPoints ?? 0;
  if (sessionSeason === (profile.monthlySeason ?? currentSeason)) {
    newMonthlyPoints = Math.max(0, newMonthlyPoints - rawDel);
  }

  // Recalculate streak from remaining sessions
  const today = tokyoYmd();
  const studiedDates = new Set(remaining.map((r) => tokyoYmd(new Date(r.startedAt))));

  // 自主学習連続の再計算
  const selfStudyDates = new Set(
    remaining.filter((r) => r.kind === "self_study").map((r) => tokyoYmd(new Date(r.startedAt)))
  );
  let selfStudyStreak = 0;
  let checkSelfDate = today;
  while (selfStudyDates.has(checkSelfDate)) {
    selfStudyStreak++;
    const d = new Date(`${checkSelfDate}T00:00:00+09:00`);
    d.setDate(d.getDate() - 1);
    checkSelfDate = tokyoYmd(d);
  }
  const sortedSelfStudyDates = [...selfStudyDates].sort();
  const lastSelfStudyLocalDate = sortedSelfStudyDates.length > 0 ? sortedSelfStudyDates[sortedSelfStudyDates.length - 1] : null;
  let streak = 0;
  let checkDate = today;
  while (studiedDates.has(checkDate)) {
    streak++;
    const d = new Date(`${checkDate}T00:00:00+09:00`);
    d.setDate(d.getDate() - 1);
    checkDate = tokyoYmd(d);
  }
  const sortedDates = [...studiedDates].sort();
  const lastStudyLocalDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

  await db.update(users).set({
    totalStudyMinutes: newTotalMinutes,
    totalPoints: newTotalPoints,
    monthlyPoints: newMonthlyPoints,
    currentStreak: streak,
    lastStudyLocalDate,
    selfStudyStreak,
    lastSelfStudyLocalDate,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, userId));

  return { ok: true };
}

/**
 * 指定分数を記録から差し引く（直近のセッションから順に削除・縮小）
 */
export async function subtractStudyMinutesAction(input: {
  minutes: number;
  subject: SubjectId;
  kind: "homework" | "self_study";
}): Promise<{ ok: true; subtracted: number } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "ログインが必要です" };

  const db = getDb();
  let remaining = input.minutes;

  // 今日の日本時間の開始時刻
  const today = tokyoYmd();
  const todayStart = new Date(`${today}T00:00:00+09:00`).toISOString();

  // 今日の同じ教科・種類のセッションを新しい順に取得
  const sessions = await db
    .select({ id: studySessions.id, minutes: studySessions.minutes })
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      eq(studySessions.subject, input.subject),
      eq(studySessions.kind, input.kind),
      gte(studySessions.startedAt, todayStart),
    ))
    .orderBy(desc(studySessions.startedAt));

  if (sessions.length === 0) return { ok: false, error: "今日の該当する記録がありません" };

  for (const session of sessions) {
    if (remaining <= 0) break;
    if (session.minutes <= remaining) {
      // セッションの分数を1に縮小（きろくに記録として残す）
      await db.update(studySessions)
        .set({ minutes: 1 })
        .where(eq(studySessions.id, session.id));
      remaining -= session.minutes - 1;
    } else {
      // セッションの一部を減らす
      await db.update(studySessions)
        .set({ minutes: session.minutes - remaining })
        .where(eq(studySessions.id, session.id));
      remaining = 0;
    }
  }

  const subtracted = input.minutes - remaining;
  if (subtracted === 0) return { ok: false, error: "今日の該当する記録がありません" };

  // ユーザーの合計分数を更新
  const [profile] = await db.select({ totalStudyMinutes: users.totalStudyMinutes })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (profile) {
    await db.update(users).set({
      totalStudyMinutes: Math.max(0, profile.totalStudyMinutes - subtracted),
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId));
  }

  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true, subtracted };
}
