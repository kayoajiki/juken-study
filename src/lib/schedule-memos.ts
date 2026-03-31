import { and, asc, eq, inArray, lt, lte, or } from "drizzle-orm";
import type { Database } from "@/db";
import { scheduleMemoDayDone, scheduleMemos } from "@/db/schema";
import { tokyoWeekdaySun0 } from "@/lib/tokyo-date";

export type MemoRepeatType = "once" | "daily" | "weekdays" | "weekly";

export type MemoRow = {
  id: string;
  /** 適用開始日（繰り返しの基点／この日だけならその日） */
  date: string;
  /** 一覧している日（完了の対象日） */
  occurrenceDate: string;
  text: string;
  done: boolean;
  repeatType: MemoRepeatType;
  weekday: number | null;
};

function todayJstString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export function memoMatchesListDate(
  r: { repeatType: string; date: string; done: boolean; weekday: number | null },
  listDate: string,
  todayJst: string
): boolean {
  if (r.repeatType === "once") {
    if (r.date === listDate) return true;
    if (listDate === todayJst && r.date < todayJst && !r.done) return true;
    return false;
  }
  if (r.date > listDate) return false;
  if (r.repeatType === "daily") return true;
  if (r.repeatType === "weekdays") {
    const w = tokyoWeekdaySun0(listDate);
    return w >= 1 && w <= 5;
  }
  if (r.repeatType === "weekly") {
    if (r.weekday == null) return false;
    return tokyoWeekdaySun0(listDate) === r.weekday;
  }
  return false;
}

export async function loadMemosForDate(
  db: Database,
  userId: string,
  listDate: string
): Promise<MemoRow[]> {
  const todayJst = todayJstString();
  const isToday = listDate === todayJst;

  const onceBranch = isToday
    ? or(
        eq(scheduleMemos.date, listDate),
        and(lt(scheduleMemos.date, todayJst), eq(scheduleMemos.done, false))
      )
    : eq(scheduleMemos.date, listDate);

  const rows = await db
    .select()
    .from(scheduleMemos)
    .where(
      and(
        eq(scheduleMemos.userId, userId),
        or(
          and(eq(scheduleMemos.repeatType, "once"), onceBranch),
          and(
            inArray(scheduleMemos.repeatType, ["daily", "weekdays", "weekly"]),
            lte(scheduleMemos.date, listDate)
          )
        )
      )
    )
    .orderBy(asc(scheduleMemos.date), asc(scheduleMemos.createdAt));

  const filtered = rows.filter((r) =>
    memoMatchesListDate(
      {
        repeatType: r.repeatType,
        date: r.date,
        done: r.done,
        weekday: r.weekday,
      },
      listDate,
      todayJst
    )
  );

  const recurringIds = filtered.filter((r) => r.repeatType !== "once").map((r) => r.id);
  const doneByMemoId = new Map<string, boolean>();
  if (recurringIds.length > 0) {
    const drows = await db
      .select()
      .from(scheduleMemoDayDone)
      .where(and(inArray(scheduleMemoDayDone.memoId, recurringIds), eq(scheduleMemoDayDone.dateKey, listDate)));
    for (const d of drows) {
      doneByMemoId.set(d.memoId, d.done);
    }
  }

  return filtered.map((r) => ({
    id: r.id,
    date: r.date,
    occurrenceDate: listDate,
    text: r.text,
    done: r.repeatType === "once" ? r.done : (doneByMemoId.get(r.id) ?? false),
    repeatType: r.repeatType as MemoRepeatType,
    weekday: r.weekday,
  }));
}
