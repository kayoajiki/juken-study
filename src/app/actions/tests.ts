"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, monthlyTestReports, testResultNodes, weeklyQuizzes } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";

// ── 週テスト ──────────────────────────────────────────────────────

export type WeeklyQuizDTO = {
  id: string;
  quiz_date: string;
  japanese_score: number | null;
  math_score: number | null;
  science_score: number | null;
  social_score: number | null;
  max_score: number | null;
};

export async function listWeeklyQuizzesAction(): Promise<WeeklyQuizDTO[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const rows = await getDb()
    .select()
    .from(weeklyQuizzes)
    .where(eq(weeklyQuizzes.userId, userId))
    .orderBy(asc(weeklyQuizzes.quizDate));
  return rows.map((r) => ({
    id: r.id,
    quiz_date: r.quizDate,
    japanese_score: r.japaneseScore,
    math_score: r.mathScore,
    science_score: r.scienceScore,
    social_score: r.socialScore,
    max_score: r.maxScore,
  }));
}

export async function saveWeeklyQuizAction(input: {
  quizDate: string;
  japaneseScore: number | null;
  mathScore: number | null;
  scienceScore: number | null;
  socialScore: number | null;
  maxScore: number | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();

  // 同じユーザー・同じ日付があれば更新、なければ挿入
  const [existing] = await db
    .select({ id: weeklyQuizzes.id })
    .from(weeklyQuizzes)
    .where(and(eq(weeklyQuizzes.userId, userId), eq(weeklyQuizzes.quizDate, input.quizDate)))
    .limit(1);

  const scores = {
    japaneseScore: input.japaneseScore,
    mathScore: input.mathScore,
    scienceScore: input.scienceScore,
    socialScore: input.socialScore,
    maxScore: input.maxScore,
  };

  if (existing) {
    await db.update(weeklyQuizzes).set(scores).where(eq(weeklyQuizzes.id, existing.id));
    return { ok: true, id: existing.id };
  }
  const id = crypto.randomUUID();
  await db.insert(weeklyQuizzes).values({
    id, userId, quizDate: input.quizDate, ...scores, createdAt: new Date().toISOString(),
  });
  return { ok: true, id };
}

export async function deleteWeeklyQuizAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();
  const [row] = await db
    .select({ userId: weeklyQuizzes.userId })
    .from(weeklyQuizzes)
    .where(eq(weeklyQuizzes.id, id))
    .limit(1);
  if (!row || row.userId !== userId) return { ok: false, error: "権限がありません" };
  await db.delete(weeklyQuizzes).where(eq(weeklyQuizzes.id, id));
  return { ok: true };
}

export type TestNodeDTO = {
  id: string;
  report_id: string;
  parent_id: string | null;
  label: string;
  subject_key: string | null;
  score: number | null;
  deviation: number | null;
  scale10: number | null;
  rank_national: string | null;
  rank_gender: string | null;
  sort_order: number;
};

type NodeRow = typeof testResultNodes.$inferSelect;

function mapNode(r: NodeRow): TestNodeDTO {
  return {
    id: r.id,
    report_id: r.reportId,
    parent_id: r.parentId,
    label: r.label,
    subject_key: r.subjectKey,
    score: r.score,
    deviation: r.deviation,
    scale10: r.scale10 ?? null,
    rank_national: r.rankNational ?? null,
    rank_gender: r.rankGender ?? null,
    sort_order: r.sortOrder,
  };
}

async function assertReportOwner(reportId: string, userId: string) {
  const r = await getDb()
    .select({ userId: monthlyTestReports.userId })
    .from(monthlyTestReports)
    .where(eq(monthlyTestReports.id, reportId))
    .limit(1);
  return r[0]?.userId === userId;
}

export async function listMonthlyReportsAction() {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const rows = await getDb()
    .select({
      id: monthlyTestReports.id,
      year_month: monthlyTestReports.yearMonth,
      title: monthlyTestReports.title,
    })
    .from(monthlyTestReports)
    .where(eq(monthlyTestReports.userId, userId))
    .orderBy(asc(monthlyTestReports.yearMonth));
  return rows;
}

export async function createMonthlyReportAction(
  yearMonth: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await getDb().insert(monthlyTestReports).values({
      id,
      userId,
      yearMonth,
      title: null,
      createdAt: now,
    });
    return { ok: true, id };
  } catch {
    return { ok: false, error: "同じ月は既にあります" };
  }
}

export async function listTestNodesAction(
  reportId: string
): Promise<TestNodeDTO[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  if (!(await assertReportOwner(reportId, userId))) return [];
  const rows = await getDb()
    .select()
    .from(testResultNodes)
    .where(eq(testResultNodes.reportId, reportId))
    .orderBy(asc(testResultNodes.sortOrder));
  return rows.map(mapNode);
}

export async function listAllTestNodesForChartsAction(): Promise<
  TestNodeDTO[]
> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const reps = await getDb()
    .select({ id: monthlyTestReports.id })
    .from(monthlyTestReports)
    .where(eq(monthlyTestReports.userId, userId));
  if (reps.length === 0) return [];
  const ids = reps.map((r) => r.id);
  const rows = await getDb()
    .select()
    .from(testResultNodes)
    .where(inArray(testResultNodes.reportId, ids));
  return rows.map(mapNode);
}

export async function saveTestNodesAction(
  reportId: string,
  nodes: {
    id: string;
    parent_id: string | null;
    label: string;
    subject_key: string | null;
    score: number | null;
    deviation: number | null;
    scale10?: number | null;
    rank_national?: string | null;
    rank_gender?: string | null;
    sort_order: number;
  }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  if (!(await assertReportOwner(reportId, userId)))
    return { ok: false, error: "権限がありません" };

  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .delete(testResultNodes)
      .where(eq(testResultNodes.reportId, reportId));

    const roots = nodes.filter((n) => !n.parent_id);
    const idMap = new Map<string, string>();

    let order = 0;
    for (const root of roots) {
      const newId = crypto.randomUUID();
      idMap.set(root.id, newId);
      await tx.insert(testResultNodes).values({
        id: newId,
        reportId,
        parentId: null,
        label: root.label,
        subjectKey: root.subject_key,
        score: root.score,
        deviation: root.deviation,
        scale10: root.scale10 ?? null,
        rankNational: root.rank_national ?? null,
        rankGender: root.rank_gender ?? null,
        sortOrder: order++,
      });
    }

    for (const root of roots) {
      const newPid = idMap.get(root.id);
      if (!newPid) continue;
      const kids = nodes.filter((n) => n.parent_id === root.id);
      let c = 0;
      for (const k of kids) {
        await tx.insert(testResultNodes).values({
          id: crypto.randomUUID(),
          reportId,
          parentId: newPid,
          label: k.label,
          subjectKey: null,
          score: k.score,
          deviation: k.deviation,
          scale10: null,
          rankNational: null,
          rankGender: null,
          sortOrder: c++,
        });
      }
    }
  });

  return { ok: true };
}

export async function deleteMonthlyReportAction(
  reportId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  if (!(await assertReportOwner(reportId, userId)))
    return { ok: false, error: "権限がありません" };

  await getDb()
    .delete(monthlyTestReports)
    .where(eq(monthlyTestReports.id, reportId));

  return { ok: true };
}

