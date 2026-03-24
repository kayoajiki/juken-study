import type { ScheduleRow } from "./schedules";

export function dbScheduleToRow(r: {
  id: string;
  subject: string;
  timeOfDay: string;
  targetMinutes: number;
  repeatType: string;
  weekday: number | null;
  targetDate: string | null;
  enabled: boolean;
}): ScheduleRow {
  const tod =
    r.timeOfDay.length === 5 ? `${r.timeOfDay}:00` : r.timeOfDay;
  return {
    id: r.id,
    subject: r.subject,
    time_of_day: tod,
    target_minutes: r.targetMinutes,
    repeat_type: r.repeatType as ScheduleRow["repeat_type"],
    weekday: r.weekday,
    target_date: r.targetDate,
    enabled: r.enabled,
  };
}
