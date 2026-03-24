import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { schedules, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { dbScheduleToRow } from "@/lib/schedule-map";
import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, userId))
    .orderBy(asc(schedules.timeOfDay));

  const urow = await db.select({ dailyGoalMinutes: users.dailyGoalMinutes })
    .from(users).where(eq(users.id, userId)).limit(1);
  const dailyGoalMinutes = urow[0]?.dailyGoalMinutes ?? 0;

  return (
    <ScheduleClient
      initial={rows.map(dbScheduleToRow)}
      dailyGoalMinutes={dailyGoalMinutes}
    />
  );
}
