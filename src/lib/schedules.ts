import { subjectById } from "./subjects";
import { tokyoYmd } from "./tokyo-date";

export type ScheduleRow = {
  id: string;
  subject: string;
  time_of_day: string;
  target_minutes: number;
  repeat_type: "daily" | "weekdays" | "weekly" | "once";
  weekday: number | null;
  target_date: string | null;
  enabled: boolean;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function parseTimeOfDay(t: string): { h: number; m: number } {
  const [hh, mm] = t.split(":");
  return { h: parseInt(hh, 10), m: parseInt(mm ?? "0", 10) };
}

/** 東京の ymd その日の時刻を表す Date（絶対時刻） */
export function tokyoLocalToDate(ymd: string, h: number, m: number): Date {
  return new Date(`${ymd}T${pad(h)}:${pad(m)}:00+09:00`);
}

export function weekdayTokyoSun0(ymd: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(new Date(`${ymd}T12:00:00+09:00`));
  const w = parts.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w ?? "Sun"] ?? 0;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setTime(d.getTime() + days * 86400000);
  return tokyoYmd(d);
}

function matchesRepeat(s: ScheduleRow, ymd: string): boolean {
  const wd = weekdayTokyoSun0(ymd);
  if (s.repeat_type === "daily") return true;
  if (s.repeat_type === "weekdays") return wd >= 1 && wd <= 5;
  if (s.repeat_type === "weekly")
    return s.weekday != null && wd === s.weekday;
  if (s.repeat_type === "once") return s.target_date === ymd;
  return false;
}

/** 次の発火時刻（なければ null） */
export function nextScheduleFire(
  s: ScheduleRow,
  from: Date = new Date()
): Date | null {
  if (!s.enabled) return null;
  const { h, m } = parseTimeOfDay(s.time_of_day);
  if (s.repeat_type === "once") {
    if (!s.target_date) return null;
    const dt = tokyoLocalToDate(s.target_date, h, m);
    return dt.getTime() > from.getTime() ? dt : null;
  }
  const startYmd = tokyoYmd(from);
  for (let i = 0; i < 14; i++) {
    const ymd = addDaysYmd(startYmd, i);
    if (!matchesRepeat(s, ymd)) continue;
    const dt = tokyoLocalToDate(ymd, h, m);
    if (dt.getTime() > from.getTime()) return dt;
  }
  return null;
}

/** 今日の予定から合計目標分数を計算 */
export function calcTodayTargetMinutes(
  rows: ScheduleRow[],
  todayYmd: string
): number {
  return rows
    .filter((r) => r.enabled && matchesRepeat(r, todayYmd))
    .reduce((sum, r) => sum + r.target_minutes, 0);
}

/** ホーム用: 直近の予定を1行テキストに */
export function formatNextScheduleHint(rows: ScheduleRow[]): string | null {
  const now = new Date();
  let best: Date | null = null;
  let bestSub = "";
  for (const s of rows) {
    if (!s.enabled) continue;
    const n = nextScheduleFire(s, now);
    if (!n) continue;
    if (!best || n.getTime() < best.getTime()) {
      best = n;
      bestSub = s.subject;
    }
  }
  if (!best) return null;
  const label = subjectById(bestSub)?.label ?? bestSub;
  const t = best.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `次の予定: ${label} ${t}〜`;
}
