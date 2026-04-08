import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { breakRules, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();
  const prof = await db
    .select({
      display_name: users.displayName,
      notification_enabled: users.notificationEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const rules = await db
    .select()
    .from(breakRules)
    .where(eq(breakRules.userId, userId))
    .orderBy(asc(breakRules.sortOrder));

  const blockMinutes = rules[0]?.minBlockMinutes ?? 30;
  const breakMinutes = rules[0]?.breakMinutes ?? Math.max(1, Math.round(blockMinutes / 6));

  return (
    <SettingsClient
      profile={prof[0] ?? null}
      blockMinutes={blockMinutes}
      breakMinutes={breakMinutes}
    />
  );
}
