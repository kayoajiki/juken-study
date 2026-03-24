# 中学受験 勉強コンパス（juken-study）

数字・グラフで努力を可視化する **Web / PWA** アプリ。データベースは **[Turso](https://turso.tech/)（libSQL）**、ORM は **Drizzle**、認証は **JWT（HTTP-only Cookie）** です。

## セットアップ

### 1. Turso

- [Turso CLI](https://docs.turso.tech/cli/introduction) で DB 作成、トークン発行
- またはローカル開発だけなら SQLite ファイルでも可（`TURSO_DATABASE_URL=file:./local-dev.db`）

### 2. 環境変数

```bash
cp .env.example .env.local
```

| 変数 | 説明 |
|------|------|
| `TURSO_DATABASE_URL` | `libsql://...` または `file:./local-dev.db` |
| `TURSO_AUTH_TOKEN` | リモート Turso のとき必須。ローカル `file:` のときは省略可 |
| `AUTH_SECRET` | セッション署名用。**16文字以上**のランダム文字列 |

### 3. スキーマ反映（Drizzle）

```bash
npm install
npm run db:push
```

### 4. 開発

```bash
npm run dev
```

ブラウザで `/signup` からユーザー登録（メール・パスワード）。

## npm スクリプト

- `npm run db:push` — スキーマを DB に反映（開発・小規模向け）
- `npm run db:studio` — Drizzle Studio（GUI）

## 機能概要

- **トータルパワー**・教科バランス・ストライク・ランク・ポイント（3倍枠）
- **タイマー**・休憩ルール・**予定**と呼びかけ（`/api/me/reminder`）
- **月次テスト**のテキスト保存とグラフ

## 以前 Supabase を使っていた場合

- Auth / Postgres / RLS は廃止し、**users テーブル + bcrypt + JWT** に置き換えています。
- 旧 `supabase/migrations` は削除済みです。上記 `db:push` で SQLite にスキーマを作成してください。
