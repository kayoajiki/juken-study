"use client";

import Link from "next/link";
import { Flame, BookOpen, Trophy } from "lucide-react";
import { rankForPoints } from "@/lib/points-rank";
import type { EarnedBadge } from "@/lib/badges";

type Profile = {
  display_name: string | null;
  total_study_minutes: number | null;
  total_points: number | null;
  current_streak: number | null;
  last_study_local_date: string | null;
  self_study_streak: number;
};

type Row = { kind: string; minutes: number; subject: string };

export function HomeClient({
  profile,
  sessions,
  nextScheduleHint,
  todayActualMin,
  todayTargetMin,
  recentBadges,
}: {
  profile: Profile | null;
  sessions: Row[];
  nextScheduleHint: string | null;
  todayActualMin: number;
  todayTargetMin: number;
  recentBadges: EarnedBadge[];
}) {
  const streak = profile?.current_streak ?? 0;
  const selfStudyStreak = profile?.self_study_streak ?? 0;
  const rank = rankForPoints(profile?.total_points ?? 0);
  const todayPct = todayTargetMin > 0
    ? Math.min(100, Math.round((todayActualMin / todayTargetMin) * 100))
    : 0;

  // sessions is kept for potential future use
  void sessions;

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      {/* ストライク ＋ 自主学習連続 ＋ ランク */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4 shadow-md shadow-orange-100">
          <div className="flex items-center gap-1 text-orange-600">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-bold">連続</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-orange-800">
            🔥 {streak}日
          </p>
          <p className="mt-1 text-[10px] text-orange-500">
            {streak > 0 ? "明日も続けよう🌟" : "今日からスタート！"}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-300 bg-violet-50 p-4 shadow-md shadow-violet-100">
          <div className="flex items-center gap-1 text-violet-600">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs font-bold">自主学習</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-violet-800">
            ✨ {selfStudyStreak}日
          </p>
          <p className="mt-1 text-[10px] text-violet-500">
            {selfStudyStreak > 0 ? "自主学習続いてる！" : "自主学習を始めよう！"}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-md shadow-amber-100">
          <div className="flex items-center gap-1 text-amber-600">
            <Trophy className="h-4 w-4" />
            <span className="text-xs font-bold">ランク</span>
          </div>
          <p className="mt-2 text-base font-bold leading-tight text-amber-800">
            {rank.name}
          </p>
          <p className="mt-1 text-[10px] text-amber-500">
            累計 {profile?.total_points ?? 0} pt
          </p>
        </div>
      </section>

      {/* 最近のバッジ */}
      {recentBadges.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold text-fuchsia-600">🏅 最近のバッジ</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentBadges.map(b => (
              <div key={b.id + b.earnedAt} className="flex flex-shrink-0 flex-col items-center rounded-2xl border-2 border-fuchsia-100 bg-fuchsia-50 px-3 py-2 shadow-sm">
                <span className="text-2xl">{b.emoji}</span>
                <span className="mt-1 text-[10px] font-bold text-fuchsia-700 max-w-[64px] text-center leading-tight">{b.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 今日の目標プログレスバー */}
      <section className="rounded-3xl border-2 border-emerald-300 bg-white p-5 shadow-lg shadow-emerald-100">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-emerald-700">🎯 今日の目標</p>
          {todayTargetMin > 0 ? (
            <p className="text-sm font-bold text-emerald-800">
              勉強した時間 {todayActualMin}分 / 目標 {todayTargetMin}分
            </p>
          ) : (
            <Link href="/schedule" className="text-xs font-bold text-fuchsia-600 underline">
              予定を設定する →
            </Link>
          )}
        </div>
        {todayTargetMin > 0 ? (
          <>
            <div className="mt-3 h-5 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className={`h-5 rounded-full transition-all duration-500 ${
                  todayPct >= 100
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                    : todayPct >= 50
                      ? "bg-gradient-to-r from-amber-400 to-orange-400"
                      : "bg-gradient-to-r from-pink-400 to-fuchsia-500"
                }`}
                style={{ width: `${todayPct}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs font-bold text-emerald-600">
              {todayPct >= 100
                ? "🎉 今日の目標達成！すごい！"
                : todayPct > 0
                  ? `あと ${todayTargetMin - todayActualMin}分！がんばれ！`
                  : "さあ今日もはじめよう！"}
            </p>
          </>
        ) : (
          <div className="mt-2 text-center">
            <p className="text-sm font-bold text-emerald-600">📅 今日の目標がまだ設定されていません</p>
            <p className="mt-1 text-xs text-slate-400">「予定」で毎日・平日などの計画を立てると、ここに進捗が表示されます</p>
          </div>
        )}
      </section>

      {/* 次の予定ヒント */}
      {nextScheduleHint ? (
        <p className="rounded-xl border-2 border-fuchsia-300 bg-fuchsia-50 px-4 py-3 text-center text-sm font-bold text-fuchsia-700">
          📅 {nextScheduleHint}
        </p>
      ) : null}

      {/* 今日まだ勉強してない促し */}
      {todayActualMin === 0 && (
        <p className="rounded-2xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3 text-center text-sm font-bold text-yellow-700">
          📣 今日はまだ勉強してないよ！一緒にやってみよう💪
        </p>
      )}

      {/* アクションボタン */}
      <Link
        href="/study"
        className="rounded-2xl bg-gradient-to-r from-pink-500 to-fuchsia-500 py-4 text-center text-lg font-bold text-white shadow-lg shadow-pink-300"
      >
        ✏️ 勉強をはじめる
      </Link>
    </main>
  );
}
