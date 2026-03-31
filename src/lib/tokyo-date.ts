/** Asia/Tokyo のカレンダー日付 YYYY-MM-DD */
export function tokyoYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 0=日曜 … 6=土曜（Asia/Tokyo の暦日 ymd） */
export function tokyoWeekdaySun0(ymd: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(new Date(`${ymd}T12:00:00+09:00`));
  const w = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? 0;
}

/** lastYmd が todayYmd のちょうど前日（東京）か */
export function isYesterdayTokyo(lastYmd: string, todayYmd: string): boolean {
  const last = new Date(lastYmd + "T12:00:00+09:00");
  const today = new Date(todayYmd + "T12:00:00+09:00");
  const days = Math.round((today.getTime() - last.getTime()) / 86400000);
  return days === 1;
}
