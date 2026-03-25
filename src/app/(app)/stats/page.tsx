import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { studySessions, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { parseBadges } from "@/lib/badges";
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

  const urow = await db.select({
    dailyGoalMinutes: users.dailyGoalMinutes,
    totalPoints: users.totalPoints,
    monthlyPoints: users.monthlyPoints,
    bestMonthlyPoints: users.bestMonthlyPoints,
    bestMonthlySeason: users.bestMonthlySeason,
    earnedBadges: users.earnedBadges,
  })
    .from(users).where(eq(users.id, userId)).limit(1);

  const dailyGoalMinutes = urow[0]?.dailyGoalMinutes ?? 0;
  const totalPoints = urow[0]?.totalPoints ?? 0;
  const monthlyPoints = urow[0]?.monthlyPoints ?? 0;
  const bestMonthlyPoints = urow[0]?.bestMonthlyPoints ?? 0;
  const bestMonthlySeason = urow[0]?.bestMonthlySeason ?? null;
  const earnedBadges = parseBadges(urow[0]?.earnedBadges ?? "[]");

  return (
    <StatsClient
      sessions={sessions}
      dailyGoalMinutes={dailyGoalMinutes}
      totalPoints={totalPoints}
      monthlyPoints={monthlyPoints}
      bestMonthlyPoints={bestMonthlyPoints}
      bestMonthlySeason={bestMonthlySeason}
      earnedBadges={earnedBadges}
    />
  );
}
