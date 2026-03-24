"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  logoutAction,
  saveBreakBlockAction,
  updateProfileAction,
} from "@/app/actions/profile";

export function SettingsClient({
  profile,
  blockMinutes: initialBlockMinutes,
}: {
  profile: {
    display_name: string | null;
    notification_enabled: boolean | null;
  } | null;
  blockMinutes: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [notif, setNotif] = useState(profile?.notification_enabled ?? true);
  const [blockMin, setBlockMin] = useState(initialBlockMinutes);
  const [msg, setMsg] = useState<string | null>(null);

  const breakMin = Math.max(1, Math.round(blockMin / 6));

  const saveProfile = async () => {
    setMsg(null);
    const res = await updateProfileAction({
      displayName: name.trim() || "がんばる君",
      notificationEnabled: notif,
    });
    if (!res.ok) setMsg(res.error);
    else setMsg("保存しました");
  };

  const requestNotif = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMsg("この端末は通知に対応していません");
      return;
    }
    const p = await Notification.requestPermission();
    if (p === "granted") {
      setNotif(true);
      const res = await updateProfileAction({
        displayName: name.trim() || "がんばる君",
        notificationEnabled: true,
      });
      if (!res.ok) setMsg(res.error);
      else setMsg("通知が許可されました");
    } else {
      setMsg("通知が拒否されました");
    }
  };

  const saveBreak = async () => {
    setMsg(null);
    const res = await saveBreakBlockAction(blockMin);
    if (!res.ok) setMsg(res.error);
    else setMsg(`休憩ルールを保存しました（${blockMin}分勉強 → ${breakMin}分休憩）`);
  };

  const logout = async () => {
    await logoutAction();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-lg space-y-8 px-4 py-8">
      <h1 className="text-xl font-bold text-violet-950">⚙️ 設定</h1>

      <section className="space-y-3 rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-md shadow-pink-100">
        <h2 className="text-sm font-bold text-pink-600">👤 表示名</h2>
        <p className="text-xs text-slate-500">
          呼びかけに「〇〇さん」として使います。
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-semibold text-violet-900 placeholder:text-slate-400"
          placeholder="なまえ"
        />
        <label className="flex items-center gap-2 text-sm font-medium text-violet-800">
          <input
            type="checkbox"
            checked={notif}
            onChange={(e) => setNotif(e.target.checked)}
          />
          予定の通知を使う（ブラウザの許可が必要）
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveProfile}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            プロフィール保存
          </button>
          {typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" ? (
            <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              ✅ 通知許可済み
            </span>
          ) : (
            <button
              type="button"
              onClick={requestNotif}
              className="rounded-lg border border-fuchsia-300 px-4 py-2 text-sm font-semibold text-fuchsia-700 hover:bg-violet-50"
            >
              🔔 通知を許可する
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border-2 border-fuchsia-200 bg-white p-4 shadow-md shadow-fuchsia-100">
        <h2 className="text-sm font-bold text-fuchsia-700">☕ 休憩ルール</h2>
        <p className="text-xs text-slate-500">
          設定した時間勉強すると、勉強画面に休憩タイマーが自動で立ち上がります。
        </p>
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-violet-700">
            勉強ブロック
          </label>
          <input
            type="number"
            min={5}
            max={180}
            value={blockMin}
            onChange={(e) => setBlockMin(Number(e.target.value))}
            className="w-24 rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-bold text-violet-900"
          />
          <span className="font-semibold text-violet-700">分</span>
        </div>
        <div className="rounded-xl bg-fuchsia-50 px-4 py-3 text-sm font-semibold text-fuchsia-700">
          ⏱ {blockMin}分 勉強したら → ☕ {breakMin}分 休憩
        </div>
        <button
          type="button"
          onClick={saveBreak}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
        >
          休憩ルールを保存
        </button>
      </section>

      {msg ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-800">
          {msg}
        </p>
      ) : null}

      <button
        type="button"
        onClick={logout}
        className="w-full rounded-xl border border-rose-200 py-3 font-semibold text-rose-500 hover:bg-rose-50"
      >
        ログアウト
      </button>
    </main>
  );
}
