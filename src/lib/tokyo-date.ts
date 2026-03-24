/** Asia/Tokyo のカレンダー日付 YYYY-MM-DD */
export function tokyoYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** lastYmd が todayYmd のちょうど前日（東京）か */
export function isYesterdayTokyo(lastYmd: string, todayYmd: string): boolean {
  const last = new Date(lastYmd + "T12:00:00+09:00");
  const today = new Date(todayYmd + "T12:00:00+09:00");
  const days = Math.round((today.getTime() - last.getTime()) / 86400000);
  return days === 1;
}
