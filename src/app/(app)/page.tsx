import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { schedules, studySessions, users } from "@/db/schema";
import { dbScheduleToRow } from "@/lib/schedule-map";
import { getSessionUserId } from "@/lib/auth/session";
import { formatNextScheduleHint } from "@/lib/schedules";
import { tokyoYmd } from "@/lib/tokyo-date";
import { parseBadges } from "@/lib/badges";
import { maybeResetMonthlySeason } from "@/lib/record-session";
import { HomeClient } from "./HomeClient";

export default async function HomePage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();
  await maybeResetMonthlySeason(db, userId);
  const urow = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const profile = urow[0];
  if (!profile) return null;

  const schRows = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.userId, userId), eq(schedules.enabled, true)))
    .orderBy(asc(schedules.timeOfDay));

  const scheduleRows = schRows.map(dbScheduleToRow);
  const hint = formatNextScheduleHint(scheduleRows);

  // 今日の実績・目標を計算
  const todayYmd = tokyoYmd();
  const todayStart = new Date(`${todayYmd}T00:00:00+09:00`).toISOString();
  const todaySessions = await db
    .select({ minutes: studySessions.minutes })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, todayStart)));
  const todayActualMin = todaySessions.reduce((s, r) => s + r.minutes, 0);
  const todayTargetMin = profile.dailyGoalMinutes ?? 0;

  const recentBadges = parseBadges(profile.earnedBadges ?? "[]").slice(-10).reverse();

  return (
    <HomeClient
      profile={{
        display_name: profile.displayName,
        total_study_minutes: profile.totalStudyMinutes,
        total_points: profile.totalPoints,
        current_streak: profile.currentStreak,
        last_study_local_date: profile.lastStudyLocalDate,
        self_study_streak: profile.selfStudyStreak ?? 0,
      }}
      nextScheduleHint={hint}
      todayActualMin={todayActualMin}
      todayTargetMin={todayTargetMin}
      recentBadges={recentBadges}
    />
  );
}
