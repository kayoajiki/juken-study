"use client";

import { useEffect, useRef, useState } from "react";
import type { ScheduleRow } from "@/lib/schedules";
import {
  parseTimeOfDay,
  tokyoLocalToDate,
  weekdayTokyoSun0,
} from "@/lib/schedules";
import { tokyoYmd } from "@/lib/tokyo-date";

function storageKey(id: string, ymd: string, suffix = "") {
  return `juken-remind-${id}-${ymd}${suffix}`;
}

function repeatMatches(s: ScheduleRow, ymd: string): boolean {
  if (!s.enabled) return false;
  if (s.repeat_type === "daily") return true;
  const wd = weekdayTokyoSun0(ymd);
  if (s.repeat_type === "weekdays") return wd >= 1 && wd <= 5;
  if (s.repeat_type === "weekly") return s.weekday != null && wd === s.weekday;
  if (s.repeat_type === "once") return s.target_date === ymd;
  return false;
}

/** scheduleTime - offsetMin（分）の前後90秒以内なら true */
function matchesTime(s: ScheduleRow, now: Date, offsetMin: number): boolean {
  const ymd = tokyoYmd(now);
  if (!repeatMatches(s, ymd)) return false;
  const { h, m } = parseTimeOfDay(s.time_of_day);
  const target = tokyoLocalToDate(ymd, h, m);
  const fireAt = new Date(target.getTime() - offsetMin * 60_000);
  return Math.abs(now.getTime() - fireAt.getTime()) <= 90_000;
}

type ReminderPayload = {
  displayName: string;
  notificationEnabled: boolean;
  schedules: ScheduleRow[];
};

type OverlayInfo = { message: string; isEarly: boolean };

// AudioContext をユーザー操作後に初期化・保持
let sharedAudioCtx: AudioContext | null = null;

function primeAudio() {
  if (typeof window === "undefined") return;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume();
  }
}

function playAlarmSound(isEarly: boolean) {
  try {
    primeAudio();
    const ctx = sharedAudioCtx;
    if (!ctx) return;

    const beep = (startTime: number, freq: number, duration: number, vol = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    };

    const t = ctx.currentTime;
    if (isEarly) {
      // ⏰ 2ビープ（10分前）
      beep(t, 880, 0.25);
      beep(t + 0.35, 880, 0.25);
    } else {
      // 🔥 3ビープ（定刻）高め
      beep(t, 1047, 0.18);
      beep(t + 0.22, 1047, 0.18);
      beep(t + 0.44, 1319, 0.4);
    }
  } catch {
    // AudioContext unavailable (silent fallback)
  }
}

export function ScheduleReminderRunner() {
  const [overlay, setOverlay] = useState<OverlayInfo | null>(null);
  const primedRef = useRef(false);

  // ユーザー操作のたびにAudioContextを起こす（iOS対策）
  // ※ primedRef.current チェックを外して毎回呼ぶ：iPadスリープ復帰後に再サスペンドされるため
  useEffect(() => {
    const handler = () => {
      primeAudio();
      primedRef.current = true;
    };
    document.addEventListener("touchstart", handler, { passive: true });
    document.addEventListener("click", handler, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("click", handler);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      let data: ReminderPayload | null = null;
      try {
        const res = await fetch("/api/me/reminder", { credentials: "include" });
        if (res.status === 401 || !alive) return;
        data = (await res.json()) as ReminderPayload;
      } catch {
        return;
      }
      if (!alive || !data) return;

      const list = data.schedules ?? [];
      const now = new Date();
      const ymd = tokyoYmd(now);
      const name = data.displayName || "きみ";

      for (const s of list) {
        // ── 10分前アラーム ──
        if (matchesTime(s, now, 10)) {
          const key = storageKey(s.id, ymd, "-early");
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, "1");
            const msg = `${name}さん、あと10分で勉強の時間だよ！準備しよう📚`;
            setOverlay({ message: msg, isEarly: true });
            playAlarmSound(true);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ もうすぐ勉強タイム", { body: msg });
            }
            setTimeout(() => { if (alive) setOverlay(null); }, 12_000);
            break;
          }
        }

        // ── 定刻アラーム ──
        if (matchesTime(s, now, 0)) {
          const key = storageKey(s.id, ymd);
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, "1");
            const msg = `${name}さん、勉強の時間です！さあはじめよう🔥`;
            setOverlay({ message: msg, isEarly: false });
            playAlarmSound(false);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("📚 勉強の時間", { body: msg });
            }
            setTimeout(() => { if (alive) setOverlay(null); }, 12_000);
            break;
          }
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!overlay) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
      <div
        className={`w-full max-w-sm rounded-3xl border-4 p-8 text-center shadow-2xl ${
          overlay.isEarly
            ? "border-amber-300 bg-amber-50 shadow-amber-200"
            : "border-fuchsia-400 bg-white shadow-fuchsia-200"
        }`}
      >
        <p className="text-4xl">{overlay.isEarly ? "⏰" : "🔥"}</p>
        <p
          className={`mt-3 text-lg font-bold leading-relaxed ${
            overlay.isEarly ? "text-amber-800" : "text-fuchsia-800"
          }`}
        >
          {overlay.message}
        </p>
        <button
          type="button"
          onClick={() => setOverlay(null)}
          className={`mt-6 rounded-full px-10 py-2.5 font-bold text-white shadow-md ${
            overlay.isEarly
              ? "bg-gradient-to-r from-amber-400 to-orange-500"
              : "bg-gradient-to-r from-fuchsia-500 to-violet-600"
          }`}
        >
          OK！
        </button>
      </div>
    </div>
  );
}
