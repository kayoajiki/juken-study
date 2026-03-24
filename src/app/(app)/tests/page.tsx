import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { monthlyTestReports, testResultNodes } from "@/db/schema";
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

  return <TestsClient initialReports={reports} initialNodes={initialNodes} />;
}
