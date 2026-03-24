"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/app/actions/auth";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signUpAction(email, password, displayName);
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
        <h1 className="text-2xl font-bold text-pink-600">🌟 新規登録</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-violet-800">
            表示名（呼びかけに使うよ）
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-medium text-violet-900 placeholder:text-slate-400"
              placeholder="たろう"
            />
          </label>
          <label className="block text-sm font-bold text-violet-800">
            メール
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-medium text-violet-900"
            />
          </label>
          <label className="block text-sm font-bold text-violet-800">
            パスワード（8文字以上推奨）
            <input
              type="password"
              required
              minLength={6}
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
            className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-3 font-bold text-white shadow-md shadow-emerald-200 disabled:opacity-50"
          >
            {loading ? "…" : "登録"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-bold text-fuchsia-600 underline">
            ログインへ
          </Link>
        </p>
      </div>
    </main>
  );
}
