"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signInAction(email, password);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="rounded-3xl border-2 border-pink-300 bg-white p-8 shadow-xl shadow-pink-200 backdrop-blur">
        <h1 className="text-2xl font-bold text-pink-600">✨ ログイン</h1>
        <p className="mt-1 text-sm font-bold text-fuchsia-600">🌟 スタディコンパス</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-violet-800">
            メール
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-medium text-violet-900 placeholder:text-slate-400"
            />
          </label>
          <label className="block text-sm font-bold text-violet-800">
            パスワード
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-medium text-violet-900"
            />
          </label>
          {err ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {err}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 py-3 font-bold text-white shadow-md shadow-pink-300 disabled:opacity-50"
          >
            {loading ? "…" : "ログイン"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          はじめて？{" "}
          <Link href="/signup" className="font-bold text-fuchsia-600 underline">
            新規登録
          </Link>
        </p>
      </div>
    </main>
  );
}
