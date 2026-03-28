"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SUBJECTS, subjectById, type SubjectId } from "@/lib/subjects";
import { tokyoYmd } from "@/lib/tokyo-date";
import { rawPointsForSession, rankForPoints, RANKS } from "@/lib/points-rank";
import { deleteStudySessionAction } from "@/app/actions/study";
import type { EarnedBadge } from "@/lib/badges";

type Row = {
  id: string;
  subject: string;
  minutes: number;
  started_at: string;
  kind: string;
};

type Tab = "graph" | "stamp" | "rank";
type Range = "week" | "month" | "all";

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

function addMonthsToYM(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfRange(r: Range): Date | null {
  const now = new Date();
  if (r === "all") return null;
  const d = new Date(now);
  if (r === "week") d.setDate(d.getDate() - 7);
  if (r === "month") d.setDate(d.getDate() - 30);
  return d;
}

export function StatsClient({
  sessions: initialSessions,
  dailyGoalMinutes,
  totalPoints,
  monthlyPoints,
  bestMonthlyPoints,
  bestMonthlySeason,
  earnedBadges,
}: {
  sessions: Row[];
  dailyGoalMinutes: number;
  totalPoints: number;
  monthlyPoints: number;
  bestMonthlyPoints: number;
  bestMonthlySeason: string | null;
  earnedBadges: EarnedBadge[];
}) {
  const [tab, setTab] = useState<Tab>("graph");
  const [sessions, setSessions] = useState<Row[]>(initialSessions);

  const recentSessionsReversed = useMemo(() => sessions.slice(0, 20), [sessions]);

  // 削除確認モーダル
  const [confirmTarget, setConfirmTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    const res = await deleteStudySessionAction(confirmTarget.id);
    setDeleting(false);
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== confirmTarget.id));
      setConfirmTarget(null);
    }
  }, [confirmTarget]);

  // ── グラフ tab ──────────────────────────────────
  const [range, setRange] = useState<Range>("week");
  const subjectColors = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.chartColor]));

  const chartData = useMemo(() => {
    const start = startOfRange(range);
    const by: Record<string, number> = {};
    for (const s of SUBJECTS) by[s.id] = 0;
    for (const row of sessions) {
      if (start && new Date(row.started_at) < start) continue;
      const k = row.subject as SubjectId;
      if (by[k] == null) by[k] = 0;
      by[k] += row.minutes;
    }
    return SUBJECTS.map((s) => ({
      name: s.label,
      id: s.id,
      minutes: by[s.id] ?? 0,
    }));
  }, [sessions, range]);

  // 教科別 宿題 vs 自主学習グラフ
  const kindChartData = useMemo(() => {
    const start = startOfRange(range);
    const bySubject: Record<string, { homework: number; self_study: number }> = {};
    for (const s of SUBJECTS) bySubject[s.id] = { homework: 0, self_study: 0 };
    for (const row of sessions) {
      if (start && new Date(row.started_at) < start) continue;
      if (!bySubject[row.subject]) bySubject[row.subject] = { homework: 0, self_study: 0 };
      if (row.kind === "homework") bySubject[row.subject].homework += row.minutes;
      else if (row.kind === "self_study") bySubject[row.subject].self_study += row.minutes;
    }
    return SUBJECTS
      .map((s) => ({
        label: s.label,
        id: s.id,
        homework: bySubject[s.id]?.homework ?? 0,
        self_study: bySubject[s.id]?.self_study ?? 0,
      }))
      .filter((d) => d.homework > 0 || d.self_study > 0);
  }, [sessions, range]);

  const kindSubjectColors = useMemo(() => {
    const count = Math.max(SUBJECTS.length - 1, 1);
    return Object.fromEntries(
      SUBJECTS.map((s, i) => {
        const ratio = i / count;
        const homeworkHue = 195 + Math.round(55 * ratio); // deep blue -> bright cyan (cool)
        const selfStudyHue = 8 + Math.round(42 * ratio); // red-orange -> vivid amber (warm)
        const homeworkLightness = 48 + Math.round(12 * ratio);
        const selfStudyLightness = 46 + Math.round(16 * ratio);
        return [
          s.id,
          {
            homework: `hsl(${homeworkHue} 92% ${homeworkLightness}%)`,
            self_study: `hsl(${selfStudyHue} 95% ${selfStudyLightness}%)`,
          },
        ];
      })
    ) as Record<string, { homework: string; self_study: string }>;
  }, []);

  // ── スタンプ tab ────────────────────────────────
  const todayYM = tokyoYmd().slice(0, 7);
  const todayYMD = tokyoYmd();
  const [displayMonth, setDisplayMonth] = useState(todayYM);

  const displayMonthLabel = useMemo(() => {
    const [y, m] = displayMonth.split("-");
    return `${y}年 ${Number(m)}月`;
  }, [displayMonth]);

  const dailyMinutes = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of sessions) {
      const ymd = tokyoYmd(new Date(row.started_at));
      map.set(ymd, (map.get(ymd) ?? 0) + row.minutes);
    }
    return map;
  }, [sessions]);

  const monthGrid = useMemo(() => {
    const [y, m] = displayMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startWd = first.getDay();
    const startDate = new Date(first);
    startDate.setDate(first.getDate() - startWd);
    return Array.from({ length: 42 }, (_, i) => {
      const cell = new Date(startDate);
      cell.setDate(startDate.getDate() + i);
      const ymd = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
      const inMonth = cell.getMonth() === m - 1;
      const actual = dailyMinutes.get(ymd) ?? 0;
      const target = dailyGoalMinutes;
      const status: "star" | "check" | "none" =
        actual > 0
          ? target === 0 || actual >= target
            ? "star"
            : "check"
          : "none";
      return { ymd, day: cell.getDate(), inMonth, actual, target, status };
    });
  }, [displayMonth, dailyMinutes, dailyGoalMinutes]);

  const monthWeeks = useMemo(() => {
    const out: (typeof monthGrid)[] = [];
    for (let i = 0; i < monthGrid.length; i += 7) out.push(monthGrid.slice(i, i + 7));
    return out;
  }, [monthGrid]);

  const monthStats = useMemo(() => {
    const inMonth = monthGrid.filter((c) => c.inMonth);
    const withTarget = inMonth.filter((c) => c.target > 0);
    const achieved = withTarget.filter((c) => c.actual >= c.target);
    const studied = inMonth.filter((c) => c.actual > 0);
    return {
      daysWithTarget: withTarget.length,
      daysAchieved: achieved.length,
      daysStudied: studied.length,
      totalMinutes: inMonth.reduce((s, c) => s + c.actual, 0),
    };
  }, [monthGrid]);

  // ── ランク tab ──────────────────────────────────
  // セッションから算出したローカル合計（グラフ用。ランクはDB値のtotalPointsを使う）
  const sessionsTotalPoints = useMemo(
    () =>
      sessions.reduce(
        (s, r) =>
          s + rawPointsForSession(r.minutes, r.kind as "homework" | "self_study"),
        0
      ),
    [sessions]
  );
  void sessionsTotalPoints;

  const currentRank = rankForPoints(totalPoints);
  const rankIdx = RANKS.findIndex((r) => r.id === currentRank.id);
  const nextRank = RANKS[rankIdx + 1] ?? null;
  const rankPct = nextRank
    ? Math.min(
        100,
        Math.round(
          ((totalPoints - currentRank.minPoints) /
            (nextRank.minPoints - currentRank.minPoints)) *
            100
        )
      )
    : 100;

  const monthlyPointsData = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of sessions) {
      const ym = tokyoYmd(new Date(row.started_at)).slice(0, 7);
      const pts = rawPointsForSession(
        row.minutes,
        row.kind as "homework" | "self_study"
      );
      map.set(ym, (map.get(ym) ?? 0) + pts);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([ym, pts]) => ({
        month: `${Number(ym.slice(5))}月`,
        points: pts,
      }));
  }, [sessions]);

  // ── タブ共通 UI ─────────────────────────────────
  const tabs: { key: Tab; label: string }[] = [
    { key: "graph", label: "📊 グラフ" },
    { key: "stamp", label: "📅 スタンプ" },
    { key: "rank", label: "🏆 ランク" },
  ];

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-xl font-bold text-violet-950">📈 きろく</h1>

      {/* 削除確認モーダル */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl border-4 border-rose-400 bg-white p-6 shadow-2xl">
            <p className="text-center text-3xl">⚠️</p>
            <p className="mt-2 text-center text-lg font-bold text-rose-700">
              本当に削除しますか？
            </p>
            <p className="mt-1 text-center text-sm font-semibold text-rose-500">
              この操作は取り消せません！
            </p>
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-slate-700">
              <p>
                📅{" "}
                {new Date(confirmTarget.started_at).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p>
                {subjectById(confirmTarget.subject)?.label ?? confirmTarget.subject} ／{" "}
                {confirmTarget.minutes}分 ／{" "}
                {confirmTarget.kind === "self_study" ? "✨ 自主" : "📚 宿題"}
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border-2 border-emerald-300 bg-emerald-50 py-3 font-bold text-emerald-700 disabled:opacity-50"
              >
                やっぱりやめる
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 py-3 font-bold text-white shadow-md disabled:opacity-50"
              >
                {deleting ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full py-2 text-sm font-bold transition-all ${
              tab === key
                ? "bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white shadow-md shadow-pink-200"
                : "border-2 border-pink-200 bg-pink-50 text-fuchsia-600 hover:border-pink-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── グラフ tab ── */}
      {tab === "graph" && (
        <>
          <p className="text-sm text-slate-400">教科ごとの勉強時間をチェック！</p>
          <div className="flex gap-2">
            {(
              [
                ["week", "今週"],
                ["month", "今月"],
                ["all", "全期間"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRange(k)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  range === k
                    ? "bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white shadow-md shadow-pink-200"
                    : "bg-pink-50 border-2 border-pink-200 text-fuchsia-600 hover:border-pink-400 hover:bg-pink-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-72 w-full rounded-2xl border-2 border-pink-200 bg-white p-2 shadow-md shadow-pink-100">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dac4f8" />
                <XAxis dataKey="name" tick={{ fill: "#6040a8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#6040a8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "#f5eaff", border: "1px solid #c0a0ec" }}
                  labelStyle={{ color: "#18003a" }}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                  {chartData.map((e) => (
                    <Cell key={e.id} fill={subjectColors[e.id] ?? "#b87af0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 教科別 宿題 vs 自主学習 */}
          <div className="rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-md shadow-sky-100">
            <p className="mb-3 text-xs font-bold text-sky-700">📚 宿題 vs ✨ 自主学習（教科別）</p>
            {kindChartData.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">記録がありません</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={kindChartData}
                    margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                    barCategoryGap="25%"
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#bae6fd" />
                    <XAxis dataKey="label" tick={{ fill: "#0369a1", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#0369a1", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#e0f2fe", border: "1px solid #7dd3fc" }}
                      formatter={(v: unknown, name: unknown) => [
                        `${v}分`,
                        name === "homework" ? "📚 宿題" : "✨ 自主学習",
                      ]}
                    />
                    <Legend
                      formatter={(v) => v === "homework" ? "📚 宿題" : "✨ 自主学習"}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="homework" radius={[4, 4, 0, 0]}>
                      {kindChartData.map((d) => (
                        <Cell
                          key={`homework-${d.id}`}
                          fill={kindSubjectColors[d.id]?.homework ?? "#38bdf8"}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="self_study" radius={[4, 4, 0, 0]}>
                      {kindChartData.map((d) => (
                        <Cell
                          key={`self-study-${d.id}`}
                          fill={kindSubjectColors[d.id]?.self_study ?? "#fb923c"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 最近の記録 */}
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold text-slate-500">📋 最近の記録</p>
            {sessions.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-400">まだ記録がありません</p>
                <a href="/study" className="mt-2 inline-block text-sm font-bold text-fuchsia-600 underline">
                  勉強を記録する →
                </a>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentSessionsReversed.map((s) => {
                  const sub = subjectById(s.subject);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 shadow-sm"
                    >
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-slate-400">
                          {new Date(s.started_at).toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            month: "numeric",
                            day: "numeric",
                            weekday: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sub?.homeworkClass ?? "bg-violet-200 text-violet-800"}`}>
                            {sub?.label ?? s.subject}
                          </span>
                          <span className="font-bold text-violet-800">{s.minutes}分</span>
                          <span className="text-xs text-slate-400">
                            {s.kind === "self_study" ? "✨ 自主" : "📚 宿題"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(s)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-400 hover:bg-rose-100"
                      >
                        🗑️
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ── スタンプ tab ── */}
      {tab === "stamp" && (
        <div className="space-y-4">
          {/* 月ナビ */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDisplayMonth(addMonthsToYM(displayMonth, -1))}
              className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 hover:bg-fuchsia-200"
            >
              ◀ 前月
            </button>
            <span className="text-sm font-bold text-violet-900">{displayMonthLabel}</span>
            <button
              type="button"
              onClick={() => setDisplayMonth(addMonthsToYM(displayMonth, 1))}
              disabled={displayMonth >= todayYM}
              className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700 hover:bg-fuchsia-200 disabled:opacity-30"
            >
              次月 ▶
            </button>
          </div>

          {/* 達成サマリー */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3">
              <p className="text-2xl font-bold text-amber-600">{monthStats.daysStudied}</p>
              <p className="text-xs font-bold text-amber-500">勉強した日</p>
            </div>
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <p className="text-2xl font-bold text-emerald-600">{monthStats.daysAchieved}</p>
              <p className="text-xs font-bold text-emerald-500">
                目標達成
                {monthStats.daysWithTarget > 0 && (
                  <span className="ml-1">/{monthStats.daysWithTarget}日</span>
                )}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-3">
              <p className="text-2xl font-bold text-sky-600">{monthStats.totalMinutes}</p>
              <p className="text-xs font-bold text-sky-500">合計分</p>
            </div>
          </div>

          {/* 達成率バー */}
          {monthStats.daysWithTarget > 0 && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-white p-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-700">🎯 今月の達成率</span>
                <span className="text-emerald-800">
                  {Math.round((monthStats.daysAchieved / monthStats.daysWithTarget) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                  style={{
                    width: `${Math.round((monthStats.daysAchieved / monthStats.daysWithTarget) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* カレンダー */}
          <div className="rounded-2xl border-2 border-fuchsia-200 bg-white p-3 shadow-sm">
            <table className="w-full table-fixed border-collapse text-center">
              <thead>
                <tr>
                  {WEEKDAY_LABELS.map((w, i) => (
                    <th key={w} className={`pb-2 text-xs font-bold ${WEEKDAY_COLORS[i]}`}>
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthWeeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((c) => {
                      const isToday = c.ymd === todayYMD;
                      return (
                        <td key={c.ymd} className="p-0.5">
                          <div
                            className={`flex flex-col items-center justify-center rounded-xl py-1 ${
                              !c.inMonth
                                ? "opacity-0"
                                : isToday
                                  ? "bg-fuchsia-100 ring-2 ring-fuchsia-400"
                                  : ""
                            }`}
                          >
                            <span
                              className={`text-xs font-semibold ${
                                isToday ? "text-fuchsia-700" : "text-violet-800"
                              }`}
                            >
                              {c.inMonth ? c.day : ""}
                            </span>
                            {c.inMonth && (
                              <span className="mt-0.5 text-base leading-none">
                                {c.status === "star"
                                  ? "⭐"
                                  : c.status === "check"
                                    ? "✅"
                                    : "　"}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex justify-center gap-4 text-xs text-slate-400">
              <span>⭐ めざせ！達成！</span>
              <span>✅ よくできました</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ランク tab ── */}
      {tab === "rank" && (
        <div className="space-y-4">
          {/* 現在ランク */}
          <div className="rounded-3xl border-2 border-amber-300 bg-white p-5 text-center shadow-lg shadow-amber-100">
            <p className="text-xs font-bold text-amber-500">現在のランク</p>
            <p className="mt-1 text-4xl font-bold text-amber-700">{currentRank.name}</p>
            <p className="mt-1 text-sm font-semibold text-amber-500">累計 {totalPoints} pt</p>
            {nextRank ? (
              <>
                <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                    style={{ width: `${rankPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-amber-600">
                  次のランク「{nextRank.name}」まで あと{" "}
                  {nextRank.minPoints - totalPoints} pt！
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm font-bold text-emerald-600">
                🎉 最高ランク達成！すごい！
              </p>
            )}
            <p className="text-xs text-amber-500">今月: {monthlyPoints} pt</p>
          </div>

          {/* 自己ベスト */}
          {bestMonthlyPoints > 0 && (
            <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 text-center">
              <p className="text-xs font-bold text-violet-600">🏆 シーズン自己ベスト</p>
              <p className="mt-1 text-2xl font-bold text-violet-800">{bestMonthlyPoints} pt</p>
              {bestMonthlySeason && <p className="text-xs text-violet-500">{bestMonthlySeason.slice(0,4)}年{Number(bestMonthlySeason.slice(5))}月</p>}
            </div>
          )}

          {/* ランク一覧 */}
          <div className="rounded-2xl border-2 border-fuchsia-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold text-fuchsia-700">🏅 ランク一覧</p>
            <ul className="space-y-2">
              {RANKS.map((r) => {
                const unlocked = totalPoints >= r.minPoints;
                return (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold ${
                      r.id === currentRank.id
                        ? "bg-amber-100 ring-2 ring-amber-300 text-amber-800"
                        : unlocked
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-900 text-slate-500"
                    }`}
                  >
                    <span>{unlocked ? "✅" : "🔒"} {r.name}</span>
                    <span className="text-xs">{r.minPoints} pt〜</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* バッジ一覧 */}
          {earnedBadges.length > 0 && (
            <div className="rounded-2xl border-2 border-fuchsia-200 bg-white p-4">
              <p className="mb-3 text-xs font-bold text-fuchsia-700">🏅 獲得バッジ一覧</p>
              <div className="grid grid-cols-3 gap-2">
                {earnedBadges.map(b => (
                  <div key={b.id + b.earnedAt} className="flex flex-col items-center rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-2 text-center">
                    <span className="text-2xl">{b.emoji}</span>
                    <span className="mt-1 text-[10px] font-bold text-fuchsia-700 leading-tight">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 月別ポイント */}
          {monthlyPointsData.length > 0 && (
            <div className="rounded-2xl border-2 border-violet-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold text-violet-700">📅 月別ポイント（最近6ヶ月）</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyPointsData}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                    <XAxis dataKey="month" tick={{ fill: "#6040a8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#6040a8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#f5eaff", border: "1px solid #c0a0ec" }}
                      formatter={(v) => [`${v ?? 0} pt`, "ポイント"]}
                    />
                    <Bar dataKey="points" radius={[6, 6, 0, 0]} fill="#f472b6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
