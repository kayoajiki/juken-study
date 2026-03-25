import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { monthlyTestReports, testResultNodes, weeklyQuizzes } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { TestsClient } from "./TestsClient";

export default async function TestsPage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();

  const reports = await db
    .select({
      id: monthlyTestReports.id,
      year_month: monthlyTestReports.yearMonth,
      title: monthlyTestReports.title,
    })
    .from(monthlyTestReports)
    .where(eq(monthlyTestReports.userId, userId))
    .orderBy(asc(monthlyTestReports.yearMonth));

  const initialNodes = reports.length > 0
    ? await db
        .select()
        .from(testResultNodes)
        .where(inArray(testResultNodes.reportId, reports.map((r) => r.id)))
    : [];

  const initialQuizzes = await db
    .select()
    .from(weeklyQuizzes)
    .where(eq(weeklyQuizzes.userId, userId))
    .orderBy(asc(weeklyQuizzes.quizDate));

  return (
    <TestsClient
      initialReports={reports}
      initialNodes={initialNodes}
      initialQuizzes={initialQuizzes.map((q) => ({
        id: q.id,
        quiz_date: q.quizDate,
        japanese_score: q.japaneseScore,
        math_score: q.mathScore,
        science_score: q.scienceScore,
        social_score: q.socialScore,
        max_score: q.maxScore,
      }))}
    />
  );
}
