"use server";

import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { getDb, schedules, scheduleMemoDayDone, scheduleMemos } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";
import { dbScheduleToRow } from "@/lib/schedule-map";
import { loadMemosForDate, type MemoRepeatType, type MemoRow } from "@/lib/schedule-memos";
import { tokyoWeekdaySun0 } from "@/lib/tokyo-date";
import type { ScheduleRow } from "@/lib/schedules";
import type { SubjectId } from "@/lib/subjects";

export type { MemoRepeatType, MemoRow } from "@/lib/schedule-memos";

export type ScheduleRowDTO = ScheduleRow;

export async function listSchedulesAction(): Promise<ScheduleRowDTO[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const rows = await getDb()
    .select()
    .from(schedules)
    .where(and(eq(schedules.userId, userId), isNull(schedules.archivedAt)))
    .orderBy(asc(schedules.timeOfDay));
  return rows.map(dbScheduleToRow);
}

/** 過去の「この日だけ」予定をアーカイブ（翌日以降に自動実行） */
export async function archivePastOnceSchedulesAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) return;
  const todayJst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  await getDb()
    .update(schedules)
    .set({ archivedAt: new Date().toISOString() })
    .where(
      and(
        eq(schedules.userId, userId),
        eq(schedules.repeatType, "once"),
        isNull(schedules.archivedAt),
        lt(schedules.targetDate, todayJst)
      )
    );
}

/** カレンダー用：特定の日のアーカイブ済み「この日だけ」予定を取得 */
export async function getArchivedSchedulesByDateAction(
  date: string
): Promise<ScheduleRowDTO[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const rows = await getDb()
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.userId, userId),
        eq(schedules.repeatType, "once"),
        eq(schedules.targetDate, date)
      )
    )
    .orderBy(asc(schedules.timeOfDay));
  return rows.map(dbScheduleToRow);
}

export async function addScheduleAction(input: {
  subject?: SubjectId;
  time: string;
  target_minutes: number;
  repeat_type: "daily" | "weekdays" | "weekly" | "once";
  weekday: number | null;
  target_date: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const tod = input.time.length === 5 ? `${input.time}:00` : input.time;
  const now = new Date().toISOString();
  await getDb().insert(schedules).values({
    id: crypto.randomUUID(),
    userId,
    subject: input.subject ?? "math",
    timeOfDay: tod,
    targetMinutes: input.target_minutes,
    repeatType: input.repeat_type,
    weekday: input.weekday,
    targetDate: input.target_date,
    enabled: true,
    createdAt: now,
  });
  return { ok: true };
}

export async function deleteScheduleAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  await getDb()
    .delete(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return { ok: true };
}

export async function toggleScheduleEnabledAction(
  id: string,
  enabled: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  await getDb()
    .update(schedules)
    .set({ enabled })
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return { ok: true };
}

// ── メモ ──────────────────────────────────────────────

export async function listMemosAction(date: string): Promise<MemoRow[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  return loadMemosForDate(getDb(), userId, date);
}

export async function addMemoAction(
  date: string,
  text: string,
  opts?: { repeatType?: MemoRepeatType; weekday?: number | null }
): Promise<{ ok: true; memo: MemoRow } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "テキストを入力してください" };
  const repeatType: MemoRepeatType = opts?.repeatType ?? "once";
  const weekday =
    repeatType === "weekly" ? (opts?.weekday ?? tokyoWeekdaySun0(date)) : null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getDb().insert(scheduleMemos).values({
    id,
    userId,
    date,
    text: trimmed,
    done: false,
    repeatType,
    weekday,
    createdAt: now,
  });
  return {
    ok: true,
    memo: {
      id,
      date,
      occurrenceDate: date,
      text: trimmed,
      done: false,
      repeatType,
      weekday,
    },
  };
}

export async function toggleMemoAction(
  id: string,
  done: boolean,
  occurrenceDate: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  const db = getDb();
  const [row] = await db
    .select()
    .from(scheduleMemos)
    .where(and(eq(scheduleMemos.id, id), eq(scheduleMemos.userId, userId)))
    .limit(1);
  if (!row) return { ok: false, error: "見つかりません" };

  if (row.repeatType === "once") {
    await db
      .update(scheduleMemos)
      .set({ done })
      .where(and(eq(scheduleMemos.id, id), eq(scheduleMemos.userId, userId)));
    return { ok: true };
  }

  const [existing] = await db
    .select()
    .from(scheduleMemoDayDone)
    .where(and(eq(scheduleMemoDayDone.memoId, id), eq(scheduleMemoDayDone.dateKey, occurrenceDate)))
    .limit(1);

  if (existing) {
    await db
      .update(scheduleMemoDayDone)
      .set({ done })
      .where(
        and(eq(scheduleMemoDayDone.memoId, id), eq(scheduleMemoDayDone.dateKey, occurrenceDate))
      );
  } else {
    await db.insert(scheduleMemoDayDone).values({
      memoId: id,
      dateKey: occurrenceDate,
      done,
    });
  }
  return { ok: true };
}

export async function deleteMemoAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "未ログイン" };
  await getDb()
    .delete(scheduleMemos)
    .where(and(eq(scheduleMemos.id, id), eq(scheduleMemos.userId, userId)));
  return { ok: true };
}
