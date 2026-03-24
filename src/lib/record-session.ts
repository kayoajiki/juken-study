import { and, eq, gte, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { studySessions, users } from "@/db/schema";
import { applyDailyTriple, rankForPoints, rawPointsForSession, type RankDef } from "./points-rank";
import { nextStreakAfterSession } from "./streak";
import { tokyoYmd } from "./tokyo-date";
import type { SubjectId } from "./subjects";
import { BADGE_CATALOG, badgePerfectMonths, parseBadges, type EarnedBadge } from "./badges";

function tokyoSeasonYM(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" })
    .format(new Date()).slice(0, 7);
}

async function wasPerfectMonth(db: Database, userId: string, ym: string): Promise<boolean> {
  const [y, m] = ym.split("-").map(Number);
  const startIso = new Date(`${ym}-01T00:00:00+09:00`).toISOString();
  const nm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const endIso = new Date(`${nm}-01T00:00:00+09:00`).toISOString();
  const rows = await db.select({ startedAt: studySessions.startedAt })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, startIso), lt(studySessions.startedAt, endIso)));
  const studiedDays = new Set(rows.map(r => tokyoYmd(new Date(r.startedAt))));
  const totalDays = new Date(y, m, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    if (!studiedDays.has(`${ym}-${String(d).padStart(2, "0")}`)) return false;
  }
  return true;
}

export async function maybeResetMonthlySeason(db: Database, userId: string): Promise<void> {
  const currentSeason = tokyoSeasonYM();
  const [row] = await db
    .select({ monthlySeason: users.monthlySeason })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return;
  if (row.monthlySeason && row.monthlySeason !== currentSeason) {
    await db.update(users).set({
      monthlyPoints: 0,
      monthlySeason: currentSeason,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId));
  }
}

export async function recordStudySessionDb(
  db: Database,
  userId: string,
  input: { subject: SubjectId; kind: "homework" | "self_study"; minutes: number; startedAt: Date; endedAt: Date }
): Promise<{ awarded: number; raw: number; streak: number; newBadges: EarnedBadge[]; prevRank: RankDef; newRank: RankDef }> {
  const today = tokyoYmd();
  const todayStart = new Date(`${today}T00:00:00+09:00`).toISOString();
  const currentSeason = tokyoSeasonYM();

  const rows = await db.select({
    totalStudyMinutes: users.totalStudyMinutes,
    totalPoints: users.totalPoints,
    currentStreak: users.currentStreak,
    lastStudyLocalDate: users.lastStudyLocalDate,
    dailyBonusTripleUsed: users.dailyBonusTripleUsed,
    dailyBonusLocalDate: users.dailyBonusLocalDate,
    selfStudyStreak: users.selfStudyStreak,
    lastSelfStudyLocalDate: users.lastSelfStudyLocalDate,
    monthlyPoints: users.monthlyPoints,
    monthlySeason: users.monthlySeason,
    bestMonthlyPoints: users.bestMonthlyPoints,
    bestMonthlySeason: users.bestMonthlySeason,
    consecutivePerfectMonths: users.consecutivePerfectMonths,
    earnedBadges: users.earnedBadges,
    dailyGoalMinutes: users.dailyGoalMinutes,
  }).from(users).where(eq(users.id, userId)).limit(1);

  const profile = rows[0];
  if (!profile) throw new Error("user not found");

  const existingBadges = parseBadges(profile.earnedBadges);
  const existingBadgeIds = new Set(existingBadges.map(b => b.id));
  const nowIso = new Date().toISOString();

  // --- Season transition ---
  let currentMonthlyPoints = profile.monthlyPoints ?? 0;
  let currentConsecutivePerfect = profile.consecutivePerfectMonths ?? 0;
  const newBadges: EarnedBadge[] = [];

  const prevSeason = profile.monthlySeason;
  if (prevSeason && prevSeason !== currentSeason) {
    const wasPerf = await wasPerfectMonth(db, userId, prevSeason);
    if (wasPerf) {
      currentConsecutivePerfect += 1;
      const def = badgePerfectMonths(currentConsecutivePerfect);
      if (!existingBadgeIds.has(def.id)) {
        const badge: EarnedBadge = { ...def, earnedAt: nowIso };
        newBadges.push(badge); existingBadges.push(badge); existingBadgeIds.add(badge.id);
      }
    } else {
      currentConsecutivePerfect = 0;
    }
    currentMonthlyPoints = 0;
  }

  // --- Points ---
  const raw = rawPointsForSession(input.minutes, input.kind);
  const { awarded, newTripleUsed, newBonusDate } = applyDailyTriple(raw, profile.dailyBonusTripleUsed ?? 0, today, profile.dailyBonusLocalDate);

  const newMonthlyPoints = currentMonthlyPoints + awarded;
  const newTotalMinutes = profile.totalStudyMinutes + input.minutes;
  const newTotalPoints = profile.totalPoints + awarded;
  const prevRank = rankForPoints(profile.totalPoints);
  const newRank = rankForPoints(newTotalPoints);
  const newBestMonthlyPoints = Math.max(profile.bestMonthlyPoints ?? 0, newMonthlyPoints);
  const newBestMonthlySeason = newMonthlyPoints > (profile.bestMonthlyPoints ?? 0) ? currentSeason : (profile.bestMonthlySeason ?? currentSeason);

  const streak = nextStreakAfterSession(profile.currentStreak ?? 0, profile.lastStudyLocalDate, today);

  // 自主学習連続（self_study のときだけ更新）
  const newSelfStudyStreak = input.kind === "self_study"
    ? nextStreakAfterSession(profile.selfStudyStreak ?? 0, profile.lastSelfStudyLocalDate ?? null, today)
    : (profile.selfStudyStreak ?? 0);
  const newLastSelfStudyLocalDate = input.kind === "self_study" ? today : (profile.lastSelfStudyLocalDate ?? null);

  // --- Insert session ---
  await db.insert(studySessions).values({
    id: crypto.randomUUID(), userId,
    subject: input.subject, kind: input.kind, minutes: input.minutes,
    startedAt: input.startedAt.toISOString(), endedAt: input.endedAt.toISOString(), createdAt: nowIso,
  });

  // --- Badge helpers ---
  const addBadge = (id: string) => {
    if (existingBadgeIds.has(id)) return;
    const def = BADGE_CATALOG[id];
    if (!def) return;
    const badge: EarnedBadge = { ...def, earnedAt: nowIso };
    newBadges.push(badge); existingBadges.push(badge); existingBadgeIds.add(id);
  };

  // Milestone badges
  if (profile.totalStudyMinutes === 0) addBadge("first_record");
  if (newTotalMinutes >= 100 && profile.totalStudyMinutes < 100) addBadge("minutes_100");
  if (newTotalMinutes >= 1000 && profile.totalStudyMinutes < 1000) addBadge("minutes_1000");
  if (newTotalMinutes >= 10000 && profile.totalStudyMinutes < 10000) addBadge("minutes_10000");

  // Rank badges
  if (prevRank.id !== newRank.id) {
    if (newRank.id === "bronze") addBadge("rank_silver");
    if (newRank.id === "gold") addBadge("rank_gold");
    if (newRank.id === "kawaguchi_master") addBadge("rank_master");
  }

  // Season best
  if (newMonthlyPoints > (profile.bestMonthlyPoints ?? 0)) addBadge("season_best");

  // Early bird (before 7am Tokyo)
  const tokyoHour = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }).format(input.startedAt));
  if (tokyoHour < 7) addBadge("early_bird");

  // Today's sessions (after insert)
  const todaySessions = await db.select({ subject: studySessions.subject, minutes: studySessions.minutes })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, todayStart)));

  const todaySubjects = new Set(todaySessions.map(r => r.subject));
  if (todaySubjects.size >= 3) addBadge("triple_subject");

  // Subject 300-min badge
  const SUBJECT_BADGE_MAP: Record<string, string> = {
    math: "subject_math", japanese: "subject_japanese", science: "subject_science",
    social: "subject_social", aptitude: "subject_aptitude",
  };
  const subjectBadgeId = SUBJECT_BADGE_MAP[input.subject];
  if (subjectBadgeId && !existingBadgeIds.has(subjectBadgeId)) {
    const subRows = await db.select({ minutes: studySessions.minutes }).from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.subject, input.subject)));
    const subTotal = subRows.reduce((s, r) => s + r.minutes, 0);
    if (subTotal >= 300) addBadge(subjectBadgeId);
  }

  // All subjects
  if (!existingBadgeIds.has("all_subjects")) {
    const allRows = await db.select({ subject: studySessions.subject }).from(studySessions).where(eq(studySessions.userId, userId));
    const allSubs = new Set(allRows.map(r => r.subject));
    if (["math","japanese","science","social","aptitude"].every(s => allSubs.has(s))) addBadge("all_subjects");
  }

  // First goal
  if (!existingBadgeIds.has("first_goal") && (profile.dailyGoalMinutes ?? 0) > 0) {
    const todayTotal = todaySessions.reduce((s, r) => s + r.minutes, 0);
    if (todayTotal >= profile.dailyGoalMinutes) addBadge("first_goal");
  }

  // --- Update user ---
  await db.update(users).set({
    totalStudyMinutes: newTotalMinutes,
    totalPoints: newTotalPoints,
    monthlyPoints: newMonthlyPoints,
    monthlySeason: currentSeason,
    bestMonthlyPoints: newBestMonthlyPoints,
    bestMonthlySeason: newBestMonthlySeason,
    consecutivePerfectMonths: currentConsecutivePerfect,
    currentStreak: streak,
    lastStudyLocalDate: today,
    selfStudyStreak: newSelfStudyStreak,
    lastSelfStudyLocalDate: newLastSelfStudyLocalDate,
    dailyBonusTripleUsed: newTripleUsed,
    dailyBonusLocalDate: newBonusDate,
    earnedBadges: JSON.stringify(existingBadges),
    updatedAt: nowIso,
  }).where(eq(users.id, userId));

  return { awarded, raw, streak, newBadges, prevRank, newRank };
}
