"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, users } from "@/db";
import { insertDefaultBreakRules } from "@/lib/break-rules-seed";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signInAction(
  email: string,
  password: string
): Promise<ActionResult> {
  const db = getDb();
  const row = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  const u = row[0];
  if (!u) return { ok: false, error: "メールまたはパスワードが違います" };
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return { ok: false, error: "メールまたはパスワードが違います" };
  await setSessionCookie(u.id);
  return { ok: true };
}

export async function signUpAction(
  email: string,
  password: string,
  displayName: string
): Promise<ActionResult> {
  const db = getDb();
  const em = email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, em))
    .limit(1);
  if (existing[0]) return { ok: false, error: "このメールはすでに登録されています" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    id,
    email: em,
    passwordHash: hash,
    displayName: displayName.trim() || "がんばる君",
    createdAt: now,
    updatedAt: now,
  });
  await insertDefaultBreakRules(db, id);
  await setSessionCookie(id);
  return { ok: true };
}

export async function signOutAction() {
  await clearSessionCookie();
}
