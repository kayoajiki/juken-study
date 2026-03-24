"use server";

import { and, eq } from "drizzle-orm";
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
