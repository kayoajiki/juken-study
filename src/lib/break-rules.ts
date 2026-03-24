export type BreakRuleRow = {
  min_block_minutes: number;
  max_block_minutes: number;
  break_minutes: number;
};

export function breakMinutesForBlock(
  sessionMinutes: number,
  rules: BreakRuleRow[]
): number | null {
  const sorted = [...rules].sort((a, b) => a.min_block_minutes - b.min_block_minutes);
  for (const r of sorted) {
    if (
      sessionMinutes >= r.min_block_minutes &&
      sessionMinutes <= r.max_block_minutes
    ) {
      return r.break_minutes;
    }
  }
  return sorted.length ? sorted[sorted.length - 1].break_minutes : null;
}
