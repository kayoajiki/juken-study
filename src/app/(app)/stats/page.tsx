import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyGoalHistory, studySessions, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { parseBadges } from "@/lib/badges";
import { tokyoYmd } from "@/lib/tokyo-date";
import { StatsClient } from "./StatsClient";

export default async function StatsPage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();

  const sessions = await db
    .select({
      id: studySessions.id,
      subject: studySessions.subject,
      minutes: studySessions.minutes,
      started_at: studySessions.startedAt,
      kind: studySessions.kind,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.startedAt))
    .limit(300);

  const [urow, goalRows] = await Promise.all([
    db.select({
      dailyGoalMinutes: users.dailyGoalMinutes,
      totalPoints: users.totalPoints,
      monthlyPoints: users.monthlyPoints,
      bestMonthlyPoints: users.bestMonthlyPoints,
      bestMonthlySeason: users.bestMonthlySeason,
      earnedBadges: users.earnedBadges,
    })
      .from(users).where(eq(users.id, userId)).limit(1),
    db.select({
      effectiveDate: dailyGoalHistory.effectiveDate,
      minutes: dailyGoalHistory.minutes,
    })
      .from(dailyGoalHistory)
      .where(eq(dailyGoalHistory.userId, userId))
      .orderBy(asc(dailyGoalHistory.effectiveDate)),
  ]);

  const dailyGoalMinutes = urow[0]?.dailyGoalMinutes ?? 0;
  const totalPoints = urow[0]?.totalPoints ?? 0;
  const monthlyPoints = urow[0]?.monthlyPoints ?? 0;
  const bestMonthlyPoints = urow[0]?.bestMonthlyPoints ?? 0;
  const bestMonthlySeason = urow[0]?.bestMonthlySeason ?? null;
  const earnedBadges = parseBadges(urow[0]?.earnedBadges ?? "[]");
  const goalHistory = goalRows.length > 0
    ? goalRows
    : [{ effectiveDate: tokyoYmd(), minutes: dailyGoalMinutes }];

  return (
    <StatsClient
      sessions={sessions}
      dailyGoalMinutes={dailyGoalMinutes}
      totalPoints={totalPoints}
      monthlyPoints={monthlyPoints}
      bestMonthlyPoints={bestMonthlyPoints}
      bestMonthlySeason={bestMonthlySeason}
      earnedBadges={earnedBadges}
      goalHistory={goalHistory}
    />
  );
}
