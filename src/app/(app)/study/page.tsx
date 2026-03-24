import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { breakRules } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { StudyClient } from "./StudyClient";

export default async function StudyPage() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const rules = await getDb()
    .select()
    .from(breakRules)
    .where(eq(breakRules.userId, userId))
    .orderBy(asc(breakRules.sortOrder));

  const blockMinutes = rules[0]?.minBlockMinutes ?? 30;
  const breakMinutes = rules[0]?.breakMinutes ?? Math.max(1, Math.round(blockMinutes / 6));

  return <StudyClient blockMinutes={blockMinutes} breakMinutes={breakMinutes} />;
}
