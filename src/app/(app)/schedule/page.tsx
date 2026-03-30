import { asc, and, eq, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { schedules, scheduleMemos, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { dbScheduleToRow } from "@/lib/schedule-map";
import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();

  const todayJst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());

  const [rows, urow, memoRows] = await Promise.all([
    db.select().from(schedules).where(eq(schedules.userId, userId)).orderBy(asc(schedules.timeOfDay)),
    db.select({ dailyGoalMinutes: users.dailyGoalMinutes }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(scheduleMemos)
      .where(
        and(
          eq(scheduleMemos.userId, userId),
          or(
            eq(scheduleMemos.date, todayJst),
            and(lt(scheduleMemos.date, todayJst), eq(scheduleMemos.done, false))
          )
        )
      )
      .orderBy(asc(scheduleMemos.date), asc(scheduleMemos.createdAt)),
  ]);

  const dailyGoalMinutes = urow[0]?.dailyGoalMinutes ?? 0;
  const initialMemos = memoRows.map((r) => ({ id: r.id, date: r.date, text: r.text, done: r.done }));

  return (
    <ScheduleClient
      initial={rows.map(dbScheduleToRow)}
      dailyGoalMinutes={dailyGoalMinutes}
      initialMemos={initialMemos}
    />
  );
}
