# ランクアップ・目標達成メール通知の設定手順

このドキュメントは、以下の通知を有効化するための手順です。

- 目標達成メール（1日1回まで）
- ランクアップメール（1日1回まで）
- 同日に最大2通（上記2種類）

## 1. DB スキーマ反映

通知履歴テーブル（`mail_notifications`）が必要です。

```bash
npm run db:push
```

## 2. Resend の準備

1. [Resend](https://resend.com/) でアカウント作成
2. API キーを発行
3. 送信元メールアドレス（From）を設定

## 3. 環境変数を設定

`.env.local`（ローカル）および Vercel の Environment Variables に設定します。

```env
RESEND_API_KEY=re_xxxxxxxxx
RANKUP_MAIL_FROM=Study App <no-reply@your-domain.com>
FAMILY_NOTIFY_EMAILS=parent1@example.com,parent2@example.com
APP_BASE_URL=https://your-app.vercel.app
```

### 変数の意味

- `RESEND_API_KEY`
  - Resend の API キー
- `RANKUP_MAIL_FROM`
  - 送信元（表示名付き可）
- `FAMILY_NOTIFY_EMAILS`
  - 通知先メール（カンマ区切りで複数指定）
- `APP_BASE_URL`
  - メール本文の「ホームへ」リンク先ベース URL

## 4. 動作確認

### A. 目標達成通知

1. その日の目標時間を設定
2. 学習記録を追加して目標を達成
3. 「目標達成メール」が1通届くことを確認
4. 同日に再度記録しても同種メールが増えないことを確認

### B. ランクアップ通知

1. 学習記録を追加してランクアップを発生させる
2. 「ランクアップメール」が1通届くことを確認
3. 同日に再度ランクアップしても同種メールが増えないことを確認

## 5. メール仕様メモ

- 送信トリガー: `recordStudySessionAction`（学習記録時）
- 通知種別:
  - `goal_achieved`
  - `rank_up`
- 送信回数制御:
  - `mail_notifications` テーブルで `userId + dateKey + kind` をユニーク管理
- 失敗時挙動:
  - メール送信に失敗しても学習記録自体は成功扱い（ベストエフォート）

## 6. よくあるハマりどころ

- メールが届かない
  - 環境変数未設定（`RESEND_API_KEY` / `RANKUP_MAIL_FROM` / `FAMILY_NOTIFY_EMAILS`）
  - 送信元メールが Resend 側で未設定
- リンク先が意図しない URL
  - `APP_BASE_URL` 未設定
- DB エラー
  - `npm run db:push` 未実行

