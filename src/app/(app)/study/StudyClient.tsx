"use client";

import { useEffect, useRef, useState } from "react";
import { recordStudySessionAction, subtractStudyMinutesAction } from "@/app/actions/study";
import { SUBJECTS, type SubjectId } from "@/lib/subjects";

type Kind = "homework" | "self_study";

/** 秒を四捨五入して分に変換（最低1分） */
function toMinutes(totalSec: number): number {
  return Math.max(1, Math.round(totalSec / 60));
}

/** Web Audio API でベル音を鳴らす＋バイブレーション
 *  audioCtx: スタートボタン押下時に作成・保持したコンテキスト（iOS対策）
 */
function playBell(audioCtx: AudioContext | null) {
  try {
    const ctx = audioCtx ?? new AudioContext();
    // iOS で suspended になっている場合は resume してから鳴らす
    const play = () => {
      const frequencies = [880, 1100, 1320];
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.start(t);
        osc.stop(t + 0.8);
      });
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(play);
    } else {
      play();
    }
  } catch {
    // AudioContext が使えない環境では無視
  }
  // スマホバイブレーション（Android対応・iOS非対応）
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

const STORAGE_KEY = "study_timer_state";

type StoredState = {
  startedAt: string | null;
  accumulatedSec: number;
  subject: SubjectId;
  kind: Kind;
  breakStartedAt: string | null; // 休憩開始時刻（カウントダウン継続用）
  breakTotalSec: number;          // 休憩の合計秒数
  lastBreakAtSec: number;         // 最後に休憩を発動した累積秒（繰り返し休憩用）
};

export function StudyClient({
  blockMinutes,
  breakMinutes,
}: {
  blockMinutes: number;
  breakMinutes: number;
}) {
  const [subject, setSubject] = useState<SubjectId>("math");
  const [kind, setKind] = useState<Kind>("homework");

  const [running, setRunning] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [accumulatedSec, setAccumulatedSec] = useState(0);
  const tickRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // iOS対策: ユーザー操作時にAudioContextを作成・保持
  const audioCtxRef = useRef<AudioContext | null>(null);

  // interval内から最新のstateを読むためのref（"latest ref" パターン）
  const startedAtRef = useRef<Date | null>(null);
  startedAtRef.current = startedAt;
  const accumulatedSecRef = useRef<number>(0);
  accumulatedSecRef.current = accumulatedSec;
  const subjectRef = useRef<SubjectId>(subject);
  subjectRef.current = subject;
  const kindRef = useRef<Kind>(kind);
  kindRef.current = kind;

  // 休憩カウントダウン
  const [breakCountdown, setBreakCountdown] = useState<number | null>(null); // null = 休憩中でない
  const breakTickRef = useRef<number | null>(null);
  // 最後に休憩を発動した累積秒（0 = まだ一度も発動していない）
  const lastBreakAtSecRef = useRef<number>(0);
  // 休憩の永続化用ref（interval内から参照）
  const breakStartedAtRef = useRef<Date | null>(null);
  const breakTotalSecRef = useRef<number>(0);

  const [message, setMessage] = useState<string | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMessage = (text: string | null) => {
    setMessage(text);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    if (text !== null) {
      msgTimerRef.current = setTimeout(() => showMessage(null), 4000);
    }
  };
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [celebration, setCelebration] = useState<{
    awarded: number;
    newBadges: import("@/lib/badges").EarnedBadge[];
    rankUp: { from: import("@/lib/points-rank").RankDef; to: import("@/lib/points-rank").RankDef } | null;
  } | null>(null);

  // マウント時にlocalStorageから復元
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as StoredState;
      setSubject(saved.subject);
      setKind(saved.kind);
      setHasSession(true);
      // lastBreakAtSec を復元（旧データ互換: なければ elapsed から推定）
      const restoredLastBreakAtSec = (saved as StoredState & { lastBreakAtSec?: number }).lastBreakAtSec ?? 0;

      if (saved.startedAt) {
        const d = new Date(saved.startedAt);
        if (!isNaN(d.getTime())) {
          const segSec = Math.floor((Date.now() - d.getTime()) / 1000);
          const total = saved.accumulatedSec + segSec;
          setStartedAt(d);
          setAccumulatedSec(saved.accumulatedSec);
          setElapsed(total);
          setRunning(true);
          setRestored(true);
          // 旧データ互換: lastBreakAtSec がなければ elapsed から推定
          lastBreakAtSecRef.current = restoredLastBreakAtSec > 0
            ? restoredLastBreakAtSec
            : blockMinutes > 0
              ? Math.floor(total / (blockMinutes * 60)) * (blockMinutes * 60)
              : 0;
        }
      } else {
        setAccumulatedSec(saved.accumulatedSec);
        setElapsed(saved.accumulatedSec);
        setRunning(false);
        setRestored(true);
        lastBreakAtSecRef.current = restoredLastBreakAtSec > 0
          ? restoredLastBreakAtSec
          : blockMinutes > 0
            ? Math.floor(saved.accumulatedSec / (blockMinutes * 60)) * (blockMinutes * 60)
            : 0;
      }
      // 休憩カウントダウンの復元
      if (saved.breakStartedAt && saved.breakTotalSec > 0) {
        const elapsedBreak = Math.floor((Date.now() - new Date(saved.breakStartedAt).getTime()) / 1000);
        const remaining = saved.breakTotalSec - elapsedBreak;
        breakStartedAtRef.current = new Date(saved.breakStartedAt);
        breakTotalSecRef.current = saved.breakTotalSec;
        if (remaining > 0) {
          setBreakCountdown(remaining);
        } else {
          // 休憩はすでに終了済み → 「閉じる」ボタンを表示する
          setBreakCountdown(0);
          breakStartedAtRef.current = null;
          breakTotalSecRef.current = 0;
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 勉強タイマー tick
  useEffect(() => {
    if (!running || !startedAt) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      const segSec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      const total = accumulatedSec + segSec;
      setElapsed(total);

      // 設定時間ごとに休憩カウントダウンを自動起動＆勉強タイマーを自動停止
      const nextBreakAt = lastBreakAtSecRef.current + blockMinutes * 60;
      if (blockMinutes > 0 && total >= nextBreakAt) {
        lastBreakAtSecRef.current = nextBreakAt; // 次の休憩基準点を更新
        playBell(audioCtxRef.current);
        // 休憩を永続化用refにセット（saveToStorageより前に）
        breakStartedAtRef.current = new Date();
        breakTotalSecRef.current = breakMinutes * 60;
        setBreakCountdown(breakMinutes * 60);

        // 勉強タイマーを自動で一時停止
        const sa = startedAtRef.current;
        if (sa) {
          const pauseSec = Math.floor((Date.now() - sa.getTime()) / 1000);
          const newAcc = accumulatedSecRef.current + pauseSec;
          setAccumulatedSec(newAcc);
          setElapsed(newAcc);
          setStartedAt(null);
          setRunning(false);
          saveToStorage({ startedAt: null, accumulatedSec: newAcc, subject: subjectRef.current, kind: kindRef.current });
        }
      }
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, startedAt, accumulatedSec, blockMinutes, breakMinutes]);

  // 休憩カウントダウン tick
  // breakCountdown が正の値になった瞬間だけインターバルを開始する
  const breakRunning = breakCountdown !== null && breakCountdown > 0;
  useEffect(() => {
    if (!breakRunning) return;
    breakTickRef.current = window.setInterval(() => {
      setBreakCountdown((prev) => {
        if (prev === null || prev <= 0) return prev;
        if (prev <= 1) {
          window.clearInterval(breakTickRef.current!);
          breakTickRef.current = null;
          playBell(audioCtxRef.current);
          // 休憩終了 → break状態をストレージからクリア
          breakStartedAtRef.current = null;
          breakTotalSecRef.current = 0;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (breakTickRef.current) {
        window.clearInterval(breakTickRef.current);
        breakTickRef.current = null;
      }
    };
  }, [breakRunning]); // breakRunning が false→true に変わった時だけ開始

  const saveToStorage = (state: Omit<StoredState, "breakStartedAt" | "breakTotalSec" | "lastBreakAtSec">) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      breakStartedAt: breakStartedAtRef.current?.toISOString() ?? null,
      breakTotalSec: breakTotalSecRef.current,
      lastBreakAtSec: lastBreakAtSecRef.current,
    }));
  };

  const start = () => {
    showMessage(null);
    setEarnedPoints(null);
    setRestored(false);
    setBreakCountdown(null);
    lastBreakAtSecRef.current = 0;
    breakStartedAtRef.current = null;
    breakTotalSecRef.current = 0;
    // iOS対策: ユーザー操作のタイミングでAudioContextを作成
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { /* ignore */ }
    }
    const now = new Date();
    setStartedAt(now);
    setAccumulatedSec(0);
    setElapsed(0);
    setRunning(true);
    setHasSession(true);
    saveToStorage({ startedAt: now.toISOString(), accumulatedSec: 0, subject, kind });
  };

  const pause = () => {
    if (!startedAt) return;
    // iOS: ユーザー操作のタイミングでAudioContextを起こしておく
    void audioCtxRef.current?.resume();
    const segSec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const newAcc = accumulatedSec + segSec;
    setAccumulatedSec(newAcc);
    setElapsed(newAcc);
    setStartedAt(null);
    setRunning(false);
    saveToStorage({ startedAt: null, accumulatedSec: newAcc, subject, kind });
  };

  const resume = () => {
    // iOS: ユーザー操作のタイミングでAudioContextを起こす
    void audioCtxRef.current?.resume();
    const now = new Date();
    setStartedAt(now);
    setRunning(true);
    setRestored(false);
    saveToStorage({ startedAt: now.toISOString(), accumulatedSec, subject, kind });
  };

  const skipBreak = () => {
    breakStartedAtRef.current = null;
    breakTotalSecRef.current = 0;
    setBreakCountdown(null);
    // ストレージの休憩状態もクリア
    saveToStorage({
      startedAt: startedAtRef.current?.toISOString() ?? null,
      accumulatedSec: accumulatedSecRef.current,
      subject: subjectRef.current,
      kind: kindRef.current,
    });
  };

  const save = async () => {
    let totalSec = accumulatedSec;
    if (running && startedAt) {
      totalSec += Math.floor((Date.now() - startedAt.getTime()) / 1000);
    }
    const totalMin = toMinutes(totalSec);
    const sessionStart = new Date(Date.now() - totalSec * 1000);
    const sessionEnd = new Date();

    setRunning(false);
    setStartedAt(null);
    setAccumulatedSec(0);
    setElapsed(0);
    setHasSession(false);
    setRestored(false);
    setBreakCountdown(null);
    lastBreakAtSecRef.current = 0;
    breakStartedAtRef.current = null;
    breakTotalSecRef.current = 0;
    localStorage.removeItem(STORAGE_KEY);

    const res = await recordStudySessionAction({
      subject,
      kind,
      minutes: totalMin,
      startedAtIso: sessionStart.toISOString(),
      endedAtIso: sessionEnd.toISOString(),
    });
    if (res.ok) {
      const rankUp = res.prevRank.id !== res.newRank.id ? { from: res.prevRank, to: res.newRank } : null;
      if (rankUp || res.newBadges.length > 0) {
        setCelebration({ awarded: res.awarded, newBadges: res.newBadges, rankUp });
      }
      showMessage(`${totalMin}分 を記録しました！`);
      setEarnedPoints(res.awarded);
    } else {
      showMessage(res.error);
    }
  };

  const [manualMinStr, setManualMinStr] = useState("0");
  const [timerAdjMinStr, setTimerAdjMinStr] = useState("0");

  const addManual = async () => {
    showMessage(null);
    setEarnedPoints(null);
    const manualMin = Math.min(180, Math.max(1, parseInt(manualMinStr, 10) || 0));
    if (manualMin <= 0) { showMessage("1分以上を入力してください"); return; }
    const end = new Date();
    const startD = new Date(end.getTime() - manualMin * 60_000);
    const res = await recordStudySessionAction({
      subject,
      kind,
      minutes: manualMin,
      startedAtIso: startD.toISOString(),
      endedAtIso: end.toISOString(),
    });
    if (res.ok) {
      const rankUp = res.prevRank.id !== res.newRank.id ? { from: res.prevRank, to: res.newRank } : null;
      if (rankUp || res.newBadges.length > 0) {
        setCelebration({ awarded: res.awarded, newBadges: res.newBadges, rankUp });
      }
      showMessage(`${manualMin}分 を追加しました！`);
      setEarnedPoints(res.awarded);
    } else {
      showMessage(res.error);
    }
  };

  const addToTimer = () => {
    showMessage(null);
    setEarnedPoints(null);
    const timerAdjMin = Math.min(180, Math.max(1, parseInt(timerAdjMinStr, 10) || 0));
    if (timerAdjMin <= 0) { showMessage("1分以上を入力してください"); return; }
    let base = accumulatedSec;
    if (running && startedAtRef.current) {
      base += Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
      setStartedAt(new Date());
    }
    const newAcc = base + timerAdjMin * 60;
    setAccumulatedSec(newAcc);
    setElapsed(newAcc);
    saveToStorage({
      startedAt: running ? new Date().toISOString() : null,
      accumulatedSec: newAcc,
      subject,
      kind,
    });
    showMessage(`タイマーに ${timerAdjMin}分 を追加しました`);
  };

  const subtractFromTimer = () => {
    showMessage(null);
    setEarnedPoints(null);
    const timerAdjMin = Math.min(180, Math.max(1, parseInt(timerAdjMinStr, 10) || 0));
    if (timerAdjMin <= 0) { showMessage("1分以上を入力してください"); return; }
    let base = accumulatedSec;
    if (running && startedAtRef.current) {
      base += Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
      setStartedAt(new Date());
    }
    const newAcc = Math.max(0, base - timerAdjMin * 60);
    setAccumulatedSec(newAcc);
    setElapsed(newAcc);
    saveToStorage({
      startedAt: running ? new Date().toISOString() : null,
      accumulatedSec: newAcc,
      subject,
      kind,
    });
    showMessage(`タイマーから ${timerAdjMin}分 を減らしました`);
  };

  const subtractManual = async () => {
    showMessage(null);
    setEarnedPoints(null);
    const manualMin = Math.min(180, Math.max(1, parseInt(manualMinStr, 10) || 0));
    if (manualMin <= 0) { showMessage("1分以上を入力してください"); return; }
    try {
      const res = await subtractStudyMinutesAction({ minutes: manualMin, subject, kind });
      if (res.ok) {
        showMessage(`${res.subtracted}分 を記録から減らしました`);
      } else {
        showMessage(res.error);
      }
    } catch (e) {
      showMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const subStyle = SUBJECTS.find((s) => s.id === subject);

  const breakPct = breakCountdown !== null
    ? Math.round((breakCountdown / (breakMinutes * 60)) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-xl font-bold text-violet-950">✏️ 勉強タイマー</h1>

      {restored && (
        <p className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
          ⏱ タイマー進行中のまま戻ってきたよ！そのまま続けてね✨
        </p>
      )}

      {/* 休憩カウントダウン */}
      {breakCountdown !== null && (
        <div className="rounded-3xl border-2 border-sky-300 bg-sky-50 p-6 text-center shadow-lg shadow-sky-100">
          <p className="text-lg font-bold text-sky-700">☕ 休憩タイム！</p>
          <p className="font-mono mt-3 text-5xl font-bold tabular-nums text-sky-800">
            {String(Math.floor(breakCountdown / 60)).padStart(2, "0")}:
            {String(breakCountdown % 60).padStart(2, "0")}
          </p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-sky-200">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all duration-1000"
              style={{ width: `${breakPct}%` }}
            />
          </div>
          {breakCountdown === 0 ? (
            <div className="mt-3 space-y-2">
              <p className="font-bold text-emerald-600">🎉 休憩おわり！また頑張ろう！</p>
              <button
                type="button"
                onClick={skipBreak}
                className="rounded-full bg-emerald-500 px-8 py-2 text-sm font-bold text-white shadow-sm"
              >
                閉じて再開へ ▶
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={skipBreak}
              className="mt-4 rounded-full border border-sky-300 px-6 py-2 text-sm font-semibold text-sky-600 hover:bg-sky-100"
            >
              スキップして再開
            </button>
          )}
        </div>
      )}

      <section className="space-y-2">
        <p className="text-sm font-bold text-pink-600">📚 教科</p>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { if (!hasSession) setSubject(s.id); }}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                subject === s.id
                  ? s.homeworkClass + " ring-2 ring-violet-200"
                  : hasSession
                    ? "border-2 border-pink-100 bg-pink-50 text-pink-300 cursor-not-allowed"
                    : "border-2 border-pink-200 bg-pink-50 text-fuchsia-600 hover:border-pink-400 hover:bg-pink-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex gap-2">
        <button
          type="button"
          onClick={() => { if (!hasSession) setKind("homework"); }}
          className={`flex-1 rounded-xl py-3 font-bold transition-all ${
            kind === "homework"
              ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-200"
              : "border-2 border-pink-200 bg-pink-50 text-fuchsia-600"
          } ${hasSession && kind !== "homework" ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          宿題
        </button>
        <button
          type="button"
          onClick={() => { if (!hasSession) setKind("self_study"); }}
          className={`flex-1 rounded-xl py-3 font-bold transition-all ${
            kind === "self_study"
              ? (subStyle?.selfStudyClass ?? "bg-amber-400 text-amber-950")
              : "border-2 border-amber-200 bg-amber-50 text-amber-700"
          } ${hasSession && kind !== "self_study" ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          ✨ 自主学習（3倍）
        </button>
      </section>

      <div
        className={`rounded-3xl border-2 bg-white p-8 text-center shadow-lg ${
          kind === "self_study"
            ? "border-amber-400 shadow-amber-100"
            : "border-fuchsia-300 shadow-fuchsia-100"
        }`}
      >
        <p className="font-mono text-6xl font-bold tabular-nums text-violet-950">
          {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
          {String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {toMinutes(elapsed)}分として記録されます（四捨五入・最低1分）
        </p>
        {blockMinutes > 0 && hasSession && breakCountdown === null && (
          <p className="mt-1 text-sm font-bold text-fuchsia-500">
            ☕ あと{Math.max(0, Math.ceil((lastBreakAtSecRef.current + blockMinutes * 60 - elapsed) / 60))}分で休憩
          </p>
        )}
        {blockMinutes > 0 && !hasSession && (
          <p className="mt-1 text-xs text-fuchsia-400">
            {blockMinutes}分で休憩タイマーが鳴ります ☕
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          {!hasSession && (
            <button
              type="button"
              onClick={start}
              className="rounded-full bg-emerald-500 px-10 py-3 font-bold text-white shadow-md shadow-emerald-200"
            >
              ▶ スタート
            </button>
          )}
          {hasSession && running && (
            <button
              type="button"
              onClick={pause}
              className="rounded-full bg-amber-400 px-8 py-3 font-bold text-amber-950 shadow-md shadow-amber-200"
            >
              ⏸ 一時停止
            </button>
          )}
          {hasSession && !running && (
            <button
              type="button"
              onClick={resume}
              className="rounded-full bg-emerald-500 px-8 py-3 font-bold text-white shadow-md shadow-emerald-200"
            >
              ▶ 再開
            </button>
          )}
          {hasSession && (
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-rose-500 px-8 py-3 font-bold text-white shadow-md shadow-rose-200"
            >
              💾 保存する
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border-2 border-fuchsia-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-pink-600">✏️ 手入力で調整</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            max={180}
            value={manualMinStr}
            onChange={(e) => setManualMinStr(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-24 rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-semibold text-violet-900"
          />
          <span className="font-semibold text-slate-400">分</span>
          <button
            type="button"
            onClick={addManual}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            ＋ 足す
          </button>
          <button
            type="button"
            onClick={subtractManual}
            className="rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-600 shadow-sm hover:bg-rose-100"
          >
            － 減らす
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          「足す」は記録に直接保存、「減らす」は保存済みの記録から直接引きます
        </p>
      </section>

      <section className="rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-sky-600">⏱ タイマーを調整</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            max={180}
            value={timerAdjMinStr}
            onChange={(e) => setTimerAdjMinStr(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-24 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 font-semibold text-sky-900"
          />
          <span className="font-semibold text-slate-400">分</span>
          <button
            type="button"
            onClick={addToTimer}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            ＋ 足す
          </button>
          {hasSession && (
            <button
              type="button"
              onClick={subtractFromTimer}
              className="rounded-lg border-2 border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-600 shadow-sm hover:bg-sky-100"
            >
              － 減らす
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          タイマーの時間を増減します（記録には保存されません）
        </p>
      </section>

      {message ? (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="font-bold text-emerald-700">✅ {message}</p>
          {earnedPoints != null && earnedPoints > 0 && (
            <p className="mt-1 text-sm font-bold text-amber-600">
              ✨ +{earnedPoints} pt ゲット！
            </p>
          )}
        </div>
      ) : null}

      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            {celebration.rankUp && (
              <div className="mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-center text-white shadow-lg">
                <p className="text-4xl">🎉</p>
                <p className="mt-1 text-lg font-bold">ランクアップ！</p>
                <p className="mt-2 text-sm opacity-80">{celebration.rankUp.from.name}</p>
                <p className="text-2xl font-bold">↓</p>
                <p className="text-2xl font-bold">{celebration.rankUp.to.name}</p>
              </div>
            )}
            {celebration.newBadges.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-center text-sm font-bold text-violet-700">🏅 新しいバッジ獲得！</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {celebration.newBadges.map(b => (
                    <div key={b.id} className="flex flex-col items-center rounded-2xl border-2 border-fuchsia-200 bg-fuchsia-50 px-3 py-2">
                      <span className="text-2xl">{b.emoji}</span>
                      <span className="mt-1 text-xs font-bold text-fuchsia-700">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mb-3 text-center text-sm font-bold text-emerald-700">✨ +{celebration.awarded} pt ゲット！</p>
            <button type="button" onClick={() => setCelebration(null)}
              className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 font-bold text-white">
              やったー！閉じる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
