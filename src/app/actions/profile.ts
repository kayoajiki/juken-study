"use server";

import { and, eq } from "drizzle-orm";
import { getDb, breakRules, dailyGoalHistory, users } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";
import { tokyoYmd } from "@/lib/tokyo-date";
import { signOutAction } from "./auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfileAction(input: {
  displayName: string;
  notificationEnabled: boolean;
}): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const now = new Date().toISOString();
  await getDb()
    .update(users)
    .set({
      displayName: input.displayName.trim() || "がんばる君",
      notificationEnabled: input.notificationEnabled,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
  return { ok: true };
}

export async function saveBreakBlockAction(
  blockMinutes: number
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();
  const breakMin = Math.max(1, Math.round(blockMinutes / 6));
  // 既存ルールをすべて削除して1件だけ挿入
  await db.delete(breakRules).where(eq(breakRules.userId, userId));
  await db.insert(breakRules).values({
    id: crypto.randomUUID(),
    userId,
    minBlockMinutes: blockMinutes,
    maxBlockMinutes: 9999,
    breakMinutes: breakMin,
    sortOrder: 0,
  });
  return { ok: true };
}

export async function setDailyGoalAction(
  minutes: number
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();
  const normalized = Math.max(0, minutes);
  await db
    .update(users)
    .set({ dailyGoalMinutes: normalized })
    .where(eq(users.id, userId));

  const today = tokyoYmd();
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: dailyGoalHistory.id })
    .from(dailyGoalHistory)
    .where(and(eq(dailyGoalHistory.userId, userId), eq(dailyGoalHistory.effectiveDate, today)))
    .limit(1);

  if (existing) {
    await db
      .update(dailyGoalHistory)
      .set({ minutes: normalized })
      .where(eq(dailyGoalHistory.id, existing.id));
  } else {
    await db.insert(dailyGoalHistory).values({
      id: crypto.randomUUID(),
      userId,
      effectiveDate: today,
      minutes: normalized,
      createdAt: now,
    });
  }
  return { ok: true };
}

export async function logoutAction() {
  await signOutAction();
}
