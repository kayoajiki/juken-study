"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
  addScheduleAction,
  archivePastOnceSchedulesAction,
  deleteScheduleAction,
  getArchivedSchedulesByDateAction,
  listSchedulesAction,
  toggleScheduleEnabledAction,
} from "@/app/actions/schedules";
import { setDailyGoalAction } from "@/app/actions/profile";
import { nextScheduleFire, type ScheduleRow } from "@/lib/schedules";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAY_COLORS = [
  "text-rose-500",
  "text-violet-700",
  "text-violet-700",
  "text-violet-700",
  "text-violet-700",
  "text-violet-700",
  "text-sky-500",
];

function tokyoTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ymdFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromYmd(ymd: string) {
  return new Date(`${ymd}T12:00:00+09:00`);
}

function addDays(ymd: string, days: number) {
  const d = dateFromYmd(ymd);
  d.setDate(d.getDate() + days);
  return ymdFromDate(d);
}

function addMonths(ymd: string, months: number) {
  const d = dateFromYmd(ymd);
  d.setMonth(d.getMonth() + months);
  return ymdFromDate(d);
}

function scheduleAppliesOnYmd(row: ScheduleRow, ymd: string) {
  const wd = dateFromYmd(ymd).getDay();
  if (!row.enabled) return false;
  if (row.repeat_type === "daily") return true;
  if (row.repeat_type === "weekdays") return wd >= 1 && wd <= 5;
  if (row.repeat_type === "weekly") return row.weekday === wd;
  if (row.repeat_type === "once") return row.target_date === ymd;
  return false;
}

function fmt2(n: number) {
  return String(n).padStart(2, "0");
}

// スクロールスナップ式ドラムピッカー
const ITEM_H = 48; // px per item
const VISIBLE = 5; // 表示する行数（中央が選択値）

function DrumPicker({
  value,
  onChange,
  options,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  unit: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammatic = useRef(false);

  const scrollToIndex = useCallback((idx: number, smooth: boolean) => {
    if (!ref.current) return;
    isProgrammatic.current = true;
    ref.current.scrollTo({ top: idx * ITEM_H, behavior: smooth ? "smooth" : "instant" });
    setTimeout(() => { isProgrammatic.current = false; }, smooth ? 350 : 30);
  }, []);

  // 初回マウント時に現在値へスクロール
  useEffect(() => {
    const idx = Math.max(0, options.indexOf(value));
    scrollToIndex(idx, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部から value が変わったときスムーズに移動
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    const idx = Math.max(0, options.indexOf(value));
    scrollToIndex(idx, true);
  }, [value, options, scrollToIndex]);

  const handleScroll = () => {
    if (isProgrammatic.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(options.length - 1, idx));
      if (options[clamped] !== value) onChange(options[clamped]);
    }, 80);
  };

  const pad = Math.floor(VISIBLE / 2); // 上下のパディング行数 = 2

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ width: 64, height: ITEM_H * VISIBLE }}
      >
        {/* 中央ハイライト（スクロールの後ろ） */}
        <div
          className="pointer-events-none absolute inset-x-1 rounded-xl bg-fuchsia-100 ring-2 ring-fuchsia-400"
          style={{ top: ITEM_H * pad, height: ITEM_H, zIndex: 0 }}
        />
        {/* スクロールリスト（ハイライトの前面） */}
        <div
          ref={ref}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "y mandatory", zIndex: 1 }}
        >
          {/* 上パディング */}
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`top-${i}`} style={{ height: ITEM_H }} />
          ))}
          {options.map((opt) => (
            <div
              key={opt}
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              className="flex cursor-pointer items-center justify-center text-2xl font-bold tabular-nums text-violet-900 active:opacity-60"
              onClick={() => onChange(opt)}
            >
              {fmt2(opt)}
            </div>
          ))}
          {/* 下パディング */}
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`bot-${i}`} style={{ height: ITEM_H }} />
          ))}
        </div>
        {/* 上下フェード（最前面） */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white/90 to-transparent" style={{ height: ITEM_H * pad, zIndex: 2 }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 to-transparent" style={{ height: ITEM_H * pad, zIndex: 2 }} />
      </div>
      <p className="text-xs font-bold text-violet-600">{unit}</p>
    </div>
  );
}

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0-24
const MIN_OPTIONS = [0, 30]; // 目標時間用
const CLOCK_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const CLOCK_MIN_OPTIONS = [0, 15, 30, 45]; // 時刻用（15分刻み）

export function ScheduleClient({
  initial,
  dailyGoalMinutes,
}: {
  initial: ScheduleRow[];
  dailyGoalMinutes: number;
}) {
  const [rows, setRows] = useState<ScheduleRow[]>(initial);

  // 1. 目標時間（独立保存）
  const [targetHour, setTargetHour] = useState(() => Math.floor(dailyGoalMinutes / 60));
  const [targetMin, setTargetMin] = useState<number>(() => dailyGoalMinutes % 60 < 30 ? 0 : 30);
  const [goalSaved, setGoalSaved] = useState(false);
  const [goalMsg, setGoalMsg] = useState<string | null>(null);

  // 2. 時刻（開始・終了）
  const [startHour, setStartHour] = useState(17);
  const [startMin, setStartMin] = useState(0);
  const [endHour, setEndHour] = useState(19);
  const [endMin, setEndMin] = useState(0);

  // 3. 繰り返し
  const [repeat, setRepeat] = useState<"daily" | "weekdays" | "weekly" | "once">("once");
  const [weekday, setWeekday] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState(() => tokyoTodayKey());
  const todayKey = tokyoTodayKey();

  const [archivedForDate, setArchivedForDate] = useState<ScheduleRow[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const startTime = `${fmt2(startHour)}:${fmt2(startMin)}`;

  const refresh = async () => {
    const data = await listSchedulesAction();
    setRows(data);
  };

  // マウント時：過去の「この日だけ」を自動アーカイブ
  useEffect(() => {
    archivePastOnceSchedulesAction().then(() => refresh());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveGoal = async () => {
    setGoalMsg(null);
    const minutes = targetHour * 60 + (targetMin as number);
    const res = await setDailyGoalAction(minutes);
    if (res.ok) {
      setGoalSaved(true);
      setTimeout(() => setGoalSaved(false), 2000);
    } else {
      setGoalMsg("保存に失敗しました");
    }
  };

  const addOne = async () => {
    setMsg(null);
    if (!timeRangeOk) {
      setMsg("おわり時刻はスタートより後にしてください");
      return;
    }
    const scheduledMinutes = endTotalMin - startTotalMin;
    const td = repeat === "once" ? selectedDate : null;
    const wd = repeat === "weekly" ? weekday : null;
    const res = await addScheduleAction({
      time: startTime,
      target_minutes: scheduledMinutes,
      repeat_type: repeat,
      weekday: wd,
      target_date: td,
    });
    if (!res.ok) { setMsg(res.error); return; }
    await refresh();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const remove = async (id: string) => {
    await deleteScheduleAction(id);
    await refresh();
  };

  const toggleEnabled = async (id: string, current: boolean) => {
    await toggleScheduleEnabledAction(id, !current);
    await refresh();
  };

  // 選択日が過去の場合、アーカイブ済み予定を取得
  useEffect(() => {
    if (selectedDate < todayKey) {
      getArchivedSchedulesByDateAction(selectedDate).then(setArchivedForDate);
    } else {
      setArchivedForDate([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const timeline = useMemo(() => {
    return rows.map((r) => ({ r, next: nextScheduleFire(r, tick) }));
  }, [rows, tick]);

  const selectedDayEvents = useMemo(() => {
    return rows
      .filter((r) => scheduleAppliesOnYmd(r, selectedDate))
      .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
  }, [rows, selectedDate]);

  const monthGrid = useMemo(() => {
    const d = dateFromYmd(selectedDate);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const startWeekday = first.getDay();
    const startDate = new Date(first);
    startDate.setDate(first.getDate() - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const cell = new Date(startDate);
      cell.setDate(startDate.getDate() + i);
      const ymd = ymdFromDate(cell);
      const count = rows.filter((r) => scheduleAppliesOnYmd(r, ymd)).length;
      return { ymd, day: cell.getDate(), weekdayIdx: cell.getDay(), inMonth: cell.getMonth() === d.getMonth(), count };
    });
  }, [rows, selectedDate]);

  const monthLabel = useMemo(() => {
    const d = dateFromYmd(selectedDate);
    return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
  }, [selectedDate]);

  const monthWeeks = useMemo(() => {
    const out: typeof monthGrid[] = [];
    for (let i = 0; i < monthGrid.length; i += 7) out.push(monthGrid.slice(i, i + 7));
    return out;
  }, [monthGrid]);

  // 終了時間 > 開始時間チェック
  const endTotalMin = endHour * 60 + endMin;
  const startTotalMin = startHour * 60 + startMin;
  const timeRangeOk = endTotalMin > startTotalMin;
  const isPastDate = repeat === "once" && selectedDate < todayKey;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-xl font-bold text-violet-950">📅 予定</h1>

      {/* 追加フォーム */}
      <section className="space-y-5 rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-md shadow-pink-100">

        {/* 1. 目標時間 */}
        <div>
          <p className="mb-1 text-xs font-bold text-pink-600">1. 目標時間を選ぶ</p>
          <p className="mb-3 text-[11px] text-slate-400">ホームの「今日の目標」に反映されます</p>
          <div className="flex items-center justify-center gap-3">
            <DrumPicker value={targetHour} onChange={setTargetHour} options={HOUR_OPTIONS} unit="時間" />
            <span className="mb-5 text-3xl font-bold text-violet-300">:</span>
            <DrumPicker value={targetMin} onChange={setTargetMin} options={MIN_OPTIONS} unit="分" />
          </div>
          {(() => {
            const m = targetHour * 60 + (targetMin as number);
            return (
              <p className="mt-2 text-center text-sm font-bold text-violet-700">
                {m > 0
                  ? `🎯 ${targetHour > 0 ? `${targetHour}時間` : ""}${(targetMin as number) > 0 ? `${targetMin}分` : ""}（${m}分）`
                  : "⚠️ 1分以上を選んでください"}
              </p>
            );
          })()}
          <button
            type="button"
            onClick={saveGoal}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 font-bold text-white shadow-md shadow-emerald-200 active:opacity-90"
          >
            💾 目標時間を保存
          </button>
          {goalSaved && (
            <p className="mt-2 animate-pulse rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-700">
              ✅ 保存しました！ホームに反映されます
            </p>
          )}
          {goalMsg && (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{goalMsg}</p>
          )}
        </div>

        <hr className="border-pink-100" />

        {/* 2. 時刻 */}
        <div>
          <p className="mb-1 text-xs font-bold text-pink-600">2. 時刻を選ぶ</p>
          <p className="mb-3 text-[11px] text-slate-400">アラームを鳴らす開始・終了時刻を設定します</p>
          <div className="grid grid-cols-2 gap-4">
            {/* 開始 */}
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-center text-xs font-bold text-amber-600">▶ スタート</p>
              <div className="flex items-center justify-center gap-2">
                <DrumPicker value={startHour} onChange={setStartHour} options={CLOCK_HOUR_OPTIONS} unit="時" />
                <span className="mb-5 text-2xl font-bold text-amber-400">:</span>
                <DrumPicker value={startMin} onChange={setStartMin} options={CLOCK_MIN_OPTIONS} unit="分" />
              </div>
            </div>
            {/* 終了 */}
            <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-3">
              <p className="mb-2 text-center text-xs font-bold text-sky-600">⏹ おわり</p>
              <div className="flex items-center justify-center gap-2">
                <DrumPicker value={endHour} onChange={setEndHour} options={CLOCK_HOUR_OPTIONS} unit="時" />
                <span className="mb-5 text-2xl font-bold text-sky-400">:</span>
                <DrumPicker value={endMin} onChange={setEndMin} options={CLOCK_MIN_OPTIONS} unit="分" />
              </div>
            </div>
          </div>
          {!timeRangeOk && (
            <p className="mt-2 text-center text-xs font-semibold text-rose-500">
              ⚠️ おわりはスタートより後にしてください
            </p>
          )}
          {timeRangeOk && (
            <p className="mt-2 text-center text-xs font-bold text-slate-500">
              {fmt2(startHour)}:{fmt2(startMin)} 〜 {fmt2(endHour)}:{fmt2(endMin)}
            </p>
          )}
        </div>

        <hr className="border-pink-100" />

        {/* 3. 繰り返し */}
        <div>
          <p className="mb-2 text-xs font-bold text-pink-600">3. 繰り返しを選ぶ</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["once", "この日だけ"],
                ["daily", "毎日"],
                ["weekdays", "平日"],
                ["weekly", "毎週"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRepeat(k)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  repeat === k
                    ? k === "once"
                      ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md"
                      : "bg-gradient-to-r from-sky-500 to-violet-600 text-white shadow-md"
                    : k === "once"
                      ? "border-2 border-rose-200 bg-rose-50 text-rose-600"
                      : "border-2 border-sky-200 bg-sky-50 text-sky-600"
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
          {repeat === "once" && (
            <div className={`mt-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
              isPastDate
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              {isPastDate
                ? `⚠️ ${selectedDate} は過去の日付です。カレンダーから今日以降の日付を選んでください。`
                : `📅 ${selectedDate} に1回だけ追加します`}
            </div>
          )}
          {repeat === "weekly" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {["日", "月", "火", "水", "木", "金", "土"].map((lab, i) => (
                <button
                  key={lab}
                  type="button"
                  onClick={() => setWeekday(i)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition-all ${
                    weekday === i
                      ? "bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-md"
                      : "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200"
                  }`}
                >
                  {lab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 追加ボタン */}
        <button
          type="button"
          onClick={addOne}
          disabled={!timeRangeOk || isPastDate}
          className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 font-bold text-white shadow-lg shadow-fuchsia-900/40 disabled:opacity-40 active:opacity-90"
        >
          ✅ この内容で追加
        </button>
        {added && (
          <p className="animate-pulse rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">
            ✅ 追加しました！下のカレンダーで確認できます📅
          </p>
        )}
        {msg && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{msg}</p>
        )}
      </section>

      {/* カレンダー */}
      <section className="space-y-3 rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-md shadow-pink-100">
        <h2 className="text-sm font-bold text-fuchsia-700">📆 カレンダー</h2>
        <div className="rounded-xl border-2 border-fuchsia-200 bg-fuchsia-50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 hover:bg-fuchsia-200"
              onClick={() => setSelectedDate(addMonths(selectedDate, -1))}
            >
              ◀ 前月
            </button>
            <span className="text-sm font-bold text-violet-900">{monthLabel}</span>
            <button
              type="button"
              className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 hover:bg-fuchsia-200"
              onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
            >
              次月 ▶
            </button>
          </div>
          <table className="w-full table-fixed border-collapse text-center">
            <thead>
              <tr>
                {WEEKDAY_LABELS.map((w, i) => (
                  <th key={w} className={`pb-1.5 text-[11px] font-bold ${WEEKDAY_COLORS[i]}`}>{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthWeeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((c) => {
                    const isActive = c.ymd === selectedDate;
                    const isToday = c.ymd === todayKey;
                    return (
                      <td key={c.ymd} className="p-0.5 align-top">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(c.ymd)}
                          className={`w-full rounded-lg px-1 py-1.5 transition-all ${
                            isActive
                              ? "bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-md shadow-pink-300"
                              : isToday
                                ? "bg-pink-400 text-white ring-2 ring-pink-300"
                                : c.inMonth
                                  ? "bg-white text-violet-900 shadow-sm hover:bg-pink-50"
                                  : "text-violet-400"
                          }`}
                        >
                          <div className="text-xs font-semibold leading-none">{c.day}</div>
                          <div className="mt-1 text-[9px] font-bold leading-none text-fuchsia-500">
                            {c.count > 0 ? `${c.count}件` : ""}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 日ナビ */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full border-2 border-fuchsia-300 bg-white px-3 py-1 text-xs font-bold text-fuchsia-600 hover:bg-fuchsia-50"
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          >
            ◀ 前日
          </button>
          <button
            type="button"
            className="rounded-full bg-fuchsia-500 px-4 py-1 text-xs font-bold text-white shadow-md ring-2 ring-fuchsia-300"
            onClick={() => setSelectedDate(todayKey)}
          >
            今日
          </button>
          <button
            type="button"
            className="rounded-full border-2 border-fuchsia-300 bg-white px-3 py-1 text-xs font-bold text-fuchsia-600 hover:bg-fuchsia-50"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          >
            翌日 ▶
          </button>
        </div>

        {/* 選択日のイベント */}
        <div>
          <h3 className="mb-2 text-xs font-bold text-fuchsia-700">{selectedDate} の予定</h3>
          {selectedDayEvents.length === 0 && archivedForDate.length === 0 ? (
            <p className="text-xs text-slate-500">この日に予定はありません</p>
          ) : (
            <ul className="space-y-1">
              {selectedDayEvents.map((r) => (
                <li
                  key={`sel-${r.id}`}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <span className="font-mono font-semibold text-amber-600">
                    {String(r.time_of_day).slice(0, 5)} スタート
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    🎯 {r.target_minutes}分
                  </span>
                </li>
              ))}
              {selectedDayEvents.length > 0 && (
                <li className="rounded-lg bg-violet-50 px-3 py-2 text-center text-sm font-bold text-violet-700">
                  合計 {selectedDayEvents.reduce((s, r) => s + r.target_minutes, 0)}分
                </li>
              )}
              {archivedForDate.length > 0 && (
                <>
                  <li className="pt-1 text-xs font-bold text-slate-400">📁 過去の予定（この日だけ）</li>
                  {archivedForDate.map((r) => (
                    <li
                      key={`arc-${r.id}`}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm opacity-70"
                    >
                      <span className="font-mono font-semibold text-slate-500">
                        {String(r.time_of_day).slice(0, 5)} スタート
                      </span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">
                        🎯 {r.target_minutes}分
                      </span>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>
      </section>

      {/* 登録一覧 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-fuchsia-700">📋 登録済みの予定</h2>
        <ul className="space-y-2">
          {timeline.length === 0 ? (
            <li className="text-sm text-slate-500">まだありません</li>
          ) : (
            timeline.map(({ r, next }) => (
              <li
                key={r.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm shadow-sm transition-opacity ${
                  r.enabled ? "border-fuchsia-200 bg-white" : "border-slate-200 bg-slate-100 opacity-60"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-amber-600">
                      {String(r.time_of_day).slice(0, 5)}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      🎯 {r.target_minutes}分
                    </span>
                    <span className={`text-xs font-semibold ${r.repeat_type === "once" ? "text-rose-500" : "text-slate-400"}`}>
                      {r.repeat_type === "daily"
                        ? "毎日"
                        : r.repeat_type === "weekdays"
                          ? "平日"
                          : r.repeat_type === "weekly"
                            ? `毎週${WEEKDAY_LABELS[r.weekday ?? 0]}`
                            : `📅 ${r.target_date ?? ""}のみ`}
                    </span>
                  </div>
                  {next ? (
                    <p className="text-[11px] text-slate-400">
                      次:{" "}
                      {next.toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        month: "numeric",
                        day: "numeric",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleEnabled(r.id, r.enabled)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      r.enabled
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                    }`}
                  >
                    {r.enabled ? "🔔 ON" : "🔕 OFF"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-xs font-bold text-rose-400 hover:bg-rose-50"
                    onClick={() => remove(r.id)}
                  >
                    削除
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
