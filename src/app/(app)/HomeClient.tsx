"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, BookOpen, Trophy } from "lucide-react";
import { rankForPoints, RANKS } from "@/lib/points-rank";
import type { EarnedBadge } from "@/lib/badges";
import { tokyoYmd } from "@/lib/tokyo-date";
import {
  addHomeTopicCommentAction,
  deleteHomeTopicCommentAction,
  getHomeTopicInteractionsAction,
  toggleHomeTopicStampAction,
} from "@/app/actions/home-topics";

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

  type Topic = {
    id: string;
    text: string;
  };

  const [rankUpTopic, setRankUpTopic] = useState<Topic | null>(null);

  type TopicComment = {
    id: string;
    text: string;
    userId: string;
    createdAtMs: number;
    mine: boolean;
  };

  type TopicInteractions = {
    counts: Record<string, { likes: number; sparks: number; cheers: number; focuses: number; stars: number }>;
    my: Record<string, { likes: boolean; sparks: boolean; cheers: boolean; focuses: boolean; stars: boolean }>;
    comments: Record<string, TopicComment[]>;
  };

  const topics = useMemo<Topic[]>(() => {
    const out: Topic[] = [];

    if (rankUpTopic) out.push(rankUpTopic);

    if (todayTargetMin > 0) {
      const remain = Math.max(0, todayTargetMin - todayActualMin);
      if (todayPct >= 100) out.push({ id: "goal_done", text: "🎉 今日の目標達成！すごい！" });
      else if (todayActualMin > 0) out.push({ id: "goal_remain", text: `あと ${remain}分！がんばれ！` });
      else out.push({ id: "goal_start", text: "さあ今日もはじめよう！" });
    } else {
      out.push({ id: "goal_not_set", text: "📅 今日の目標がまだ設定されていません" });
    }

    if (nextScheduleHint) {
      out.push({ id: "next_schedule", text: `📅 次の予定：${nextScheduleHint}` });
    }

    if (streak > 0) {
      out.push({ id: "streak", text: `🔥 連続 ${streak}日！明日も続けよう！` });
    }

    if (selfStudyStreak > 0) {
      out.push({ id: "self_streak", text: `✨ 自主学習 ${selfStudyStreak}日！` });
    }

    // トピックが多い場合は絞る（UIの高さを固定したい）
    return out.slice(0, 4);
  }, [nextScheduleHint, rankUpTopic, selfStudyStreak, streak, todayActualMin, todayPct, todayTargetMin]);

  useEffect(() => {
    // 前回のランクと比べて、変化があれば「ランクアップ」を1回だけ出す
    const key = "home_rank_prev";
    try {
      const raw = localStorage.getItem(key);
      const prevRankId = raw ? (JSON.parse(raw)?.rankId as string | undefined) : undefined;

      if (prevRankId && prevRankId !== rank.id) {
        const from = RANKS.find((r) => r.id === prevRankId);
        setRankUpTopic({
          id: `rank_up_${prevRankId}_${rank.id}`,
          text: `🏆 ランクアップ！${from?.name ?? prevRankId} → ${rank.name}`,
        });
      } else {
        setRankUpTopic(null);
      }

      localStorage.setItem(key, JSON.stringify({ rankId: rank.id, updatedAt: Date.now() }));
    } catch {
      // ignore
    }
  }, [rank.id, rank.name]);

  // sessions is kept for potential future use
  void sessions;

  const todayYmd = tokyoYmd();

  const [topicIndex, setTopicIndex] = useState(0);
  const [topicSlideKey, setTopicSlideKey] = useState(0);

  const [interactions, setInteractions] = useState<TopicInteractions>({
    counts: {},
    my: {},
    comments: {},
  });

  const [commentOpenTopicId, setCommentOpenTopicId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const commentDraftRef = useRef<HTMLInputElement | null>(null);
  const topicLocked = commentOpenTopicId !== null; // コメント入力中は自動遷移を止める

  const topicIds = useMemo(() => topics.map((t) => t.id), [topics]);
  const topicIdsKey = topicIds.join("|");

  const refreshTopics = async (idsOverride?: string[]) => {
    const ids = idsOverride ?? topicIds;
    if (ids.length === 0) return;
    const res = await getHomeTopicInteractionsAction({ dateKey: todayYmd, topicIds: ids });
    setInteractions((prev) => ({
      counts: { ...prev.counts, ...res.counts },
      my: { ...prev.my, ...res.my },
      comments: { ...prev.comments, ...res.comments },
    }));
  };

  useEffect(() => {
    void refreshTopics(topicIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayYmd, topicIdsKey]);

  useEffect(() => {
    if (topics.length <= 1) return;
    if (topicLocked) return;
    const t = window.setInterval(() => {
      setTopicIndex((i) => (i + 1) % topics.length);
    }, 7000);
    return () => window.clearInterval(t);
  }, [topics.length, topicLocked]);

  useEffect(() => {
    // トピック数が変わってもスライド位置がはみ出さないようにする
    if (topicLocked) return;
    setTopicIndex((i) => Math.min(i, Math.max(0, topics.length - 1)));
  }, [topics.length, topicLocked]);

  useEffect(() => {
    setTopicSlideKey((k) => k + 1);
    // トピックが切り替わったらコメント欄は閉じる（レイアウトを安定させる）
    setCommentOpenTopicId((cur) => {
      const nextId = topics[topicIndex]?.id;
      return cur && cur !== nextId ? null : cur;
    });
    setCommentDraft("");
  }, [topicIndex, topics]);

  const activeTopic = topics[topicIndex] ?? null;
  const activeComments = activeTopic ? interactions.comments[activeTopic.id] ?? [] : [];

  const toggleLike = async (topicId: string) => {
    await toggleHomeTopicStampAction({ dateKey: todayYmd, topicId, stampType: "likes" });
    await refreshTopics([topicId]);
  };

  const toggleSpark = async (topicId: string) => {
    await toggleHomeTopicStampAction({ dateKey: todayYmd, topicId, stampType: "sparks" });
    await refreshTopics([topicId]);
  };

  const toggleCheers = async (topicId: string) => {
    await toggleHomeTopicStampAction({ dateKey: todayYmd, topicId, stampType: "cheers" });
    await refreshTopics([topicId]);
  };

  const toggleFocus = async (topicId: string) => {
    await toggleHomeTopicStampAction({ dateKey: todayYmd, topicId, stampType: "focuses" });
    await refreshTopics([topicId]);
  };

  const toggleStar = async (topicId: string) => {
    await toggleHomeTopicStampAction({ dateKey: todayYmd, topicId, stampType: "stars" });
    await refreshTopics([topicId]);
  };

  const submitComment = async (topicId: string) => {
    const text = commentDraft.trim();
    if (!text) return;

    await addHomeTopicCommentAction({ dateKey: todayYmd, topicId, text });
    await refreshTopics([topicId]);

    setCommentDraft("");
    setCommentOpenTopicId(null);
  };

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

      {/* 今日のトピックス（スライド） */}
      <section className="relative rounded-2xl border-2 border-fuchsia-200 bg-white p-4 shadow-sm">
        <style>{`
          @keyframes topicSlideIn {
            from { transform: translateY(6px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .topic-slide-in { animation: topicSlideIn 320ms ease-out both; }
        `}</style>

        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-fuchsia-700">🗓 今日のトピックス</p>
          {topics.length > 1 ? (
            <p className="text-[10px] font-bold text-slate-400">
              {topicIndex + 1}/{topics.length}
            </p>
          ) : null}
        </div>

        <div className="relative mt-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {activeTopic ? (
                <p
                  key={`${activeTopic.id}_${topicSlideKey}`}
                  className="topic-slide-in text-sm font-bold text-fuchsia-900"
                >
                  {activeTopic.text}
                </p>
              ) : (
                <p className="text-sm font-bold text-fuchsia-900">今日のトピックスはありません</p>
              )}
            </div>

            <div className="shrink-0">
              {/* 横スクロールなし。2列グリッド（下段右にコメント）で高さを抑える */}
              <div className="grid grid-cols-2 gap-2 justify-items-end pb-1 w-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTopic) return;
                    void toggleLike(activeTopic.id);
                  }}
                  className={`rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                    activeTopic && interactions.my[activeTopic.id]?.likes
                      ? "bg-fuchsia-600 text-white"
                      : "bg-white text-fuchsia-700 hover:bg-fuchsia-50 border border-fuchsia-200"
                  } whitespace-nowrap`}
                  aria-label="いいね"
                >
                  👍
                  <span className="hidden sm:inline">
                    {activeTopic ? interactions.counts[activeTopic.id]?.likes ?? 0 : 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTopic) return;
                    void toggleSpark(activeTopic.id);
                  }}
                  className={`rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                    activeTopic && interactions.my[activeTopic.id]?.sparks
                      ? "bg-amber-500 text-amber-950"
                      : "bg-white text-amber-600 hover:bg-amber-50 border border-amber-200"
                  } whitespace-nowrap`}
                  aria-label="応援スタンプ"
                >
                  ✨
                  <span className="hidden sm:inline">
                    {activeTopic ? interactions.counts[activeTopic.id]?.sparks ?? 0 : 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTopic) return;
                    void toggleCheers(activeTopic.id);
                  }}
                  className={`rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                    activeTopic && interactions.my[activeTopic.id]?.cheers
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                  } whitespace-nowrap`}
                  aria-label="がんばれ"
                >
                  💪
                  <span className="hidden sm:inline">
                    {activeTopic ? interactions.counts[activeTopic.id]?.cheers ?? 0 : 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTopic) return;
                    void toggleFocus(activeTopic.id);
                  }}
                  className={`rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                    activeTopic && interactions.my[activeTopic.id]?.focuses
                      ? "bg-sky-700 text-white"
                      : "bg-white text-sky-700 hover:bg-sky-50 border border-sky-200"
                  } whitespace-nowrap`}
                  aria-label="集中"
                >
                  🎯
                  <span className="hidden sm:inline">
                    {activeTopic ? interactions.counts[activeTopic.id]?.focuses ?? 0 : 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTopic) return;
                    void toggleStar(activeTopic.id);
                  }}
                  className={`rounded-full px-2 py-1 text-xs font-bold shadow-sm ${
                    activeTopic && interactions.my[activeTopic.id]?.stars
                      ? "bg-rose-600 text-white"
                      : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
                  } whitespace-nowrap`}
                  aria-label="ナイス"
                >
                  🌟
                  <span className="hidden sm:inline">
                    {activeTopic ? interactions.counts[activeTopic.id]?.stars ?? 0 : 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTopic) return;
                    setCommentOpenTopicId((cur) => (cur === activeTopic.id ? null : activeTopic.id));
                    setCommentDraft("");
                    // 次の render 後にフォーカスする
                    window.setTimeout(() => commentDraftRef.current?.focus(), 50);
                  }}
                  className="rounded-full border border-fuchsia-200 bg-white px-2 py-1 text-xs font-bold text-fuchsia-700 hover:bg-fuchsia-50 whitespace-nowrap"
                  aria-label="コメント"
                >
                  💬
                  <span className="hidden sm:inline">{activeComments.length}</span>
                </button>
              </div>

              {/* コメントは入力済みのものがある限り、常に表示する */}
              {activeComments.length > 0 && (
                <div className="mt-2 max-w-[190px] text-right">
                  <div className="space-y-1">
                    {activeComments.slice(-3).map((c) => (
                      <div key={c.id} className="flex items-start justify-end gap-2">
                        <p className="min-w-0 break-words text-[11px] font-bold text-slate-700 leading-tight">
                          {c.text}
                        </p>
                        {c.mine && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!activeTopic) return;
                              void (async () => {
                                await deleteHomeTopicCommentAction({
                                  dateKey: todayYmd,
                                  topicId: activeTopic.id,
                                  commentId: c.id,
                                });
                                await refreshTopics([activeTopic.id]);
                              })();
                            }}
                            className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-500 hover:bg-rose-100"
                            aria-label="コメントを削除"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeTopic && commentOpenTopicId === activeTopic.id && (
            <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-xl border border-fuchsia-200 bg-white p-3 shadow-lg">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitComment(activeTopic.id);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={commentDraftRef}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="一言コメント…"
                  className="w-full rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2 py-2 text-xs font-bold text-fuchsia-900 placeholder:text-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
                  maxLength={60}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm"
                >
                  送信
                </button>
              </form>
              <div className="mt-2 text-[10px] font-bold text-slate-400">※ 一言コメント</div>
            </div>
          )}
        </div>
      </section>

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
