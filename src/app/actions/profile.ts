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
  blockMinutes: number,
  breakMinutes: number
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();
  const blockMin = Math.max(5, Math.min(180, Math.round(blockMinutes)));
  const breakMin = Math.max(0, Math.min(30, Math.round(breakMinutes)));
  // 既存ルールをすべて削除して1件だけ挿入
  await db.delete(breakRules).where(eq(breakRules.userId, userId));
  await db.insert(breakRules).values({
    id: crypto.randomUUID(),
    userId,
    minBlockMinutes: blockMin,
    maxBlockMinutes: 9999,
    breakMinutes: breakMin,
    sortOrder: 0,
  });
  return { ok: true };
}

export async function setDailyGoalAction(
  minutes: number,
  date?: string // YYYY-MM-DD、省略時は今日
): Promise<ActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();
  const normalized = Math.max(0, minutes);
  const today = tokyoYmd();
  const targetDate = date ?? today;

  // 今日以前の場合のみ users.dailyGoalMinutes（ホーム表示用）を更新
  if (targetDate <= today) {
    await db
      .update(users)
      .set({ dailyGoalMinutes: normalized })
      .where(eq(users.id, userId));
  }

  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: dailyGoalHistory.id })
    .from(dailyGoalHistory)
    .where(and(eq(dailyGoalHistory.userId, userId), eq(dailyGoalHistory.effectiveDate, targetDate)))
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
      effectiveDate: targetDate,
      minutes: normalized,
      createdAt: now,
    });
  }
  return { ok: true };
}

export async function logoutAction() {
  await signOutAction();
}
