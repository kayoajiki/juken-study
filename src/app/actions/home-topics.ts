"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, homeTopicComments, homeTopicStamps } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";

type StampType = "likes" | "sparks" | "cheers" | "focuses" | "stars";

export async function getHomeTopicInteractionsAction(input: {
  dateKey: string;
  topicIds: string[];
}): Promise<{
  counts: Record<string, { likes: number; sparks: number; cheers: number; focuses: number; stars: number }>;
  my: Record<string, { likes: boolean; sparks: boolean; cheers: boolean; focuses: boolean; stars: boolean }>;
  comments: Record<string, { id: string; userId: string; text: string; createdAtMs: number }[]>;
}> {
  const userId = await getSessionUserId();
  const topicIds = input.topicIds ?? [];

  if (!userId) {
    // Home はログイン前提だが、念のため匿名は何も返さない
    return { counts: {}, my: {}, comments: {} };
  }

  const counts: Record<string, { likes: number; sparks: number; cheers: number; focuses: number; stars: number }> = {};
  const my: Record<string, { likes: boolean; sparks: boolean; cheers: boolean; focuses: boolean; stars: boolean }> = {};
  const comments: Record<string, { id: string; userId: string; text: string; createdAtMs: number }[]> = {};

  for (const id of topicIds) {
    counts[id] = { likes: 0, sparks: 0, cheers: 0, focuses: 0, stars: 0 };
    my[id] = { likes: false, sparks: false, cheers: false, focuses: false, stars: false };
    comments[id] = [];
  }

  if (topicIds.length === 0) return { counts, my, comments };

  const db = getDb();

  const stampRows = await db
    .select()
    .from(homeTopicStamps)
    .where(and(eq(homeTopicStamps.userId, userId), eq(homeTopicStamps.dateKey, input.dateKey), inArray(homeTopicStamps.topicId, topicIds)));

  for (const row of stampRows) {
    const t = row.topicId;
    if (!counts[t]) continue;
    counts[t].likes += row.likes ? 1 : 0;
    counts[t].sparks += row.sparks ? 1 : 0;
    counts[t].cheers += row.cheers ? 1 : 0;
    counts[t].focuses += row.focuses ? 1 : 0;
    counts[t].stars += row.stars ? 1 : 0;

    my[t] = {
      likes: !!row.likes,
      sparks: !!row.sparks,
      cheers: !!row.cheers,
      focuses: !!row.focuses,
      stars: !!row.stars,
    };
  }

  const commentRows = await db
    .select({
      id: homeTopicComments.id,
      userId: homeTopicComments.userId,
      topicId: homeTopicComments.topicId,
      text: homeTopicComments.comment,
      createdAtMs: homeTopicComments.createdAtMs,
    })
    .from(homeTopicComments)
    .where(and(eq(homeTopicComments.userId, userId), eq(homeTopicComments.dateKey, input.dateKey), inArray(homeTopicComments.topicId, topicIds)))
    .orderBy(desc(homeTopicComments.createdAtMs));

  for (const c of commentRows) {
    if (!comments[c.topicId]) continue;
    // 最大3件に制限（最新順で来ているので先に詰めていく）
    if (comments[c.topicId].length >= 3) continue;
    comments[c.topicId].push({
      id: c.id,
      userId: c.userId,
      text: c.text,
      createdAtMs: c.createdAtMs,
    });
  }

  // UI表示は古い順にしたい（見やすさのため）
  for (const topicId of topicIds) {
    comments[topicId] = (comments[topicId] ?? []).slice().reverse();
  }

  // ログイン無しでも counts/comments は見える
  return { counts, my, comments };
}

export async function toggleHomeTopicStampAction(input: {
  dateKey: string;
  topicId: string;
  stampType: StampType;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "ログインが必要です" };

  const db = getDb();
  const [row] = await db
    .select()
    .from(homeTopicStamps)
    .where(and(eq(homeTopicStamps.userId, userId), eq(homeTopicStamps.dateKey, input.dateKey), eq(homeTopicStamps.topicId, input.topicId)))
    .limit(1);

  const now = new Date().toISOString();
  if (!row) {
    const values = {
      id: crypto.randomUUID(),
      userId,
      dateKey: input.dateKey,
      topicId: input.topicId,
      likes: input.stampType === "likes",
      sparks: input.stampType === "sparks",
      cheers: input.stampType === "cheers",
      focuses: input.stampType === "focuses",
      stars: input.stampType === "stars",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(homeTopicStamps).values(values);
  } else {
    const update: Partial<Record<StampType, boolean>> = {
      [input.stampType]: !row[input.stampType],
    };
    await db
      .update(homeTopicStamps)
      .set({
        ...update,
        updatedAt: now,
      })
      .where(eq(homeTopicStamps.id, row.id));
  }

  // サーバキャッシュの再描画（念のため）
  revalidatePath("/");
  return { ok: true };
}

export async function addHomeTopicCommentAction(input: {
  dateKey: string;
  topicId: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "ログインが必要です" };

  const text = input.text.trim();
  if (!text) return { ok: false, error: "コメントが空です" };

  const trimmed = text.slice(0, 48);
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  const db = getDb();

  // 最大3件まで（古いものから落とす）
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(homeTopicComments)
      .where(and(eq(homeTopicComments.userId, userId), eq(homeTopicComments.dateKey, input.dateKey), eq(homeTopicComments.topicId, input.topicId)))
      .orderBy(desc(homeTopicComments.createdAtMs));

    // 追加後に合計3件になるように、既存は「最新2件」だけ残す
    const toDelete = existing.slice(2);
    for (const row of toDelete) {
      await tx.delete(homeTopicComments).where(eq(homeTopicComments.id, row.id));
    }

    await tx.insert(homeTopicComments).values({
      id: crypto.randomUUID(),
      userId,
      dateKey: input.dateKey,
      topicId: input.topicId,
      comment: trimmed,
      createdAtMs: nowMs,
      createdAt: nowIso,
    });
  });

  revalidatePath("/");
  return { ok: true };
}

