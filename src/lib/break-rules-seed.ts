import type { Database } from "@/db";
import { breakRules } from "@/db/schema";

export async function insertDefaultBreakRules(db: Database, userId: string) {
  const defaults = [
    { min: 1, max: 25, br: 5, ord: 0 },
    { min: 26, max: 50, br: 10, ord: 1 },
    { min: 51, max: 9999, br: 15, ord: 2 },
  ];
  for (const d of defaults) {
    await db.insert(breakRules).values({
      id: crypto.randomUUID(),
      userId,
      minBlockMinutes: d.min,
      maxBlockMinutes: d.max,
      breakMinutes: d.br,
      sortOrder: d.ord,
    });
  }
}
