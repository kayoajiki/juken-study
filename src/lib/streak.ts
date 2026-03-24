import { isYesterdayTokyo, tokyoYmd } from "./tokyo-date";

export function nextStreakAfterSession(
  currentStreak: number,
  lastStudyLocalDate: string | null,
  sessionDateTokyo: string
): number {
  if (!lastStudyLocalDate) {
    return 1;
  }
  if (lastStudyLocalDate === sessionDateTokyo) {
    return Math.max(1, currentStreak);
  }
  if (isYesterdayTokyo(lastStudyLocalDate, sessionDateTokyo)) {
    return currentStreak + 1;
  }
  return 1;
}

export function tokyoNowYmd() {
  return tokyoYmd(new Date());
}
