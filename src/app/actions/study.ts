"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, mailNotifications, studySessions, users } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";
import { recordStudySessionDb } from "@/lib/record-session";
import { rawPointsForSession } from "@/lib/points-rank";
import { tokyoYmd } from "@/lib/tokyo-date";
import type { SubjectId } from "@/lib/subjects";
import type { EarnedBadge } from "@/lib/badges";
import type { RankDef } from "@/lib/points-rank";

type MailKind = "rank_up" | "goal_achieved";

async function sendMailViaResend(input: { subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RANKUP_MAIL_FROM;
  const toRaw = process.env.FAMILY_NOTIFY_EMAILS ?? process.env.NOTIFY_EMAILS;
  if (!apiKey || !from || !toRaw) return;

  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`mail send failed: ${res.status} ${txt}`);
  }
}

async function trySendDailyMail(input: {
  userId: string;
  dateKey: string;
  kind: MailKind;
  subject: string;
  html: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select({ id: mailNotifications.id })
    .from(mailNotifications)
    .where(
      and(
        eq(mailNotifications.userId, input.userId),
        eq(mailNotifications.dateKey, input.dateKey),
        eq(mailNotifications.kind, input.kind)
      )
    )
    .limit(1);
  if (existing) return;

  await sendMailViaResend({ subject: input.subject, html: input.html });
  await db.insert(mailNotifications).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    dateKey: input.dateKey,
    kind: input.kind,
    createdAt: new Date().toISOString(),
  });
}

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

  // 入力値の基本バリデーション
  if (!Number.isFinite(input.minutes) || input.minutes < 1 || input.minutes > 600) {
    return { ok: false, error: "分数が不正です（1〜600分）" };
  }
  const startedAt = new Date(input.startedAtIso);
  const endedAt = new Date(input.endedAtIso);
  if (isNaN(startedAt.getTime()) || isNaN(endedAt.getTime())) {
    return { ok: false, error: "日時が不正です" };
  }
  if (endedAt <= startedAt) {
    return { ok: false, error: "終了時刻は開始時刻より後である必要があります" };
  }
  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  if (startedAt.getTime() < now - oneYearMs || endedAt.getTime() > now + 60_000) {
    return { ok: false, error: "日時が範囲外です" };
  }

  try {
    const db = getDb();
    const { awarded, newBadges, prevRank, newRank } = await recordStudySessionDb(getDb(), userId, {
      subject: input.subject,
      kind: input.kind,
      minutes: input.minutes,
      startedAt,
      endedAt,
    });

    // 通知は学習記録とは分離し、失敗しても記録を成功扱いにする
    void (async () => {
      try {
        const [user] = await db
          .select({
            displayName: users.displayName,
            dailyGoalMinutes: users.dailyGoalMinutes,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!user) return;

        const dateKey = tokyoYmd(new Date(input.endedAtIso));
        const homeUrl = process.env.APP_BASE_URL
          ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/`
          : "https://example.com/";
        const displayName = user.displayName?.trim() || "お子さま";

        // 目標達成通知（1日1回）
        if ((user.dailyGoalMinutes ?? 0) > 0) {
          const todayStart = new Date(`${dateKey}T00:00:00+09:00`).toISOString();
          const todayRows = await db
            .select({ minutes: studySessions.minutes })
            .from(studySessions)
            .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, todayStart)));
          const todayTotal = todayRows.reduce((s, r) => s + r.minutes, 0);
          if (todayTotal >= user.dailyGoalMinutes) {
            await trySendDailyMail({
              userId,
              dateKey,
              kind: "goal_achieved",
              subject: "🎯 目標達成しました！",
              html: `
                <div style="font-family: system-ui, -apple-system, sans-serif; line-height:1.6;">
                  <h2>🎯 ${displayName}さんが今日の目標を達成！</h2>
                  <p>今日の学習時間は <b>${todayTotal}分</b> です。</p>
                  <p><a href="${homeUrl}" style="display:inline-block;padding:10px 14px;background:#db2777;color:#fff;border-radius:8px;text-decoration:none;">🏠 ホームでスタンプ・コメントする</a></p>
                </div>
              `,
            });
          }
        }

        // ランクアップ通知（1日1回）
        if (prevRank.id !== newRank.id) {
          await trySendDailyMail({
            userId,
            dateKey,
            kind: "rank_up",
            subject: "🏆 ランクアップしました！",
            html: `
              <div style="font-family: system-ui, -apple-system, sans-serif; line-height:1.6;">
                <h2>🏆 ${displayName}さんがランクアップ！</h2>
                <p><b>${prevRank.name}</b> → <b>${newRank.name}</b></p>
                <p><a href="${homeUrl}" style="display:inline-block;padding:10px 14px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;">🏠 ホームでスタンプ・コメントする</a></p>
              </div>
            `,
          });
        }
      } catch (mailErr) {
        console.error("mail notification failed:", mailErr);
      }
    })();

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
      // セッションを丸ごと相殺できる場合は削除
      await db.delete(studySessions)
        .where(eq(studySessions.id, session.id));
      remaining -= session.minutes;
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

  // ユーザーの合計分数・ポイントを更新
  const [profile] = await db.select({
    totalStudyMinutes: users.totalStudyMinutes,
    totalPoints: users.totalPoints,
    monthlyPoints: users.monthlyPoints,
    monthlySeason: users.monthlySeason,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (profile) {
    const rawDeduct = rawPointsForSession(subtracted, input.kind);
    const currentSeason = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
    }).format(new Date()).slice(0, 7);
    const newMonthlyPoints = (profile.monthlySeason ?? currentSeason) === currentSeason
      ? Math.max(0, (profile.monthlyPoints ?? 0) - rawDeduct)
      : (profile.monthlyPoints ?? 0);
    await db.update(users).set({
      totalStudyMinutes: Math.max(0, profile.totalStudyMinutes - subtracted),
      totalPoints: Math.max(0, (profile.totalPoints ?? 0) - rawDeduct),
      monthlyPoints: newMonthlyPoints,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId));
  }

  revalidatePath("/");
  revalidatePath("/stats");
  return { ok: true, subtracted };
}
