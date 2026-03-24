import { asc, and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";
import { getDb } from "@/db";
import { schedules, users } from "@/db/schema";
import { dbScheduleToRow } from "@/lib/schedule-map";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const urow = await db
    .select({
      displayName: users.displayName,
      notificationEnabled: users.notificationEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const u = urow[0];

  const srows = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.userId, userId), eq(schedules.enabled, true)))
    .orderBy(asc(schedules.timeOfDay));

  return NextResponse.json({
    displayName: u?.displayName ?? "きみ",
    notificationEnabled: u?.notificationEnabled ?? false,
    schedules: srows.map(dbScheduleToRow),
  });
}
