# PrioriTodo — Claude Code 恒久指示

このファイルは Claude Code（および派生 AI）が毎セッション自動で読みます。
ここに書かれたルールは**すべての作業で常に有効**です。

## 1. 絶対にやらないこと（ユーザーデータ保護）

本アプリは Firestore にユーザー個人のタスク・予定・時間割・授業メモを保存します。
以下の行為は**常に禁止**。例外は「ユーザーが明示的に依頼し、私（ユーザー）が許可した場合のみ」。

- 本番 Firestore の **実データを読み出す / ダンプする / コピーする**
- Firestore Admin SDK / サービスアカウント鍵を扱う
- 既存ユーザーの `users/{uid}` 以下のドキュメントを**横断**するコード（集計・一覧化・エクスポート）を書く
- Firestore Security Rules を**緩める**変更（`allow read, write: if true;` 等）
- `.env` / `.env.local` / `firebase-adminsdk-*.json` / `service-account*.json` 等の**秘密ファイルを開く・コミット・表示**
- 分析・ログ送信・外部 API への本番データ送信を**新規追加**
- `cloudStorage.ts` の「ユーザーを跨ぐ読み取り」を**導入**する変更

## 2. Firestore データモデル（変えないでほしい構造）

```
users/{uid}                    ← uid は Firebase Auth のユーザー ID
users/{uid}/private/app_state  ← ユーザーのタスク/カテゴリ/時間割/グループ等をまとめた 1 ドキュメント
```

- 1 ユーザー = 自分の uid 配下しか読み書きできない（Firestore Rules で強制）
- 別ユーザーとの共有機能を追加する場合は、**必ず私に相談してから** Rules を設計

## 3. セキュリティルール（`firestore.rules`）

- ルールを書き換える PR では、**必ず差分を説明**し、緩和する場合は理由を明記
- `allow` を `if request.auth != null && request.auth.uid == uid` より緩くしない
- 新しいコレクションを追加したら、同じ PR で Rules も追加

## 4. 認証・ドメイン

- `authDomain` はブラウザでは `window.location.hostname`（同一オリジン化）
- `next.config.ts` の `/__/auth/*` rewrite を削除・変更しない（モバイル Chrome のログイン維持のため）
- Firebase 本番プロジェクトの設定（Authorized domains, OAuth consent）には触らない

## 5. デプロイとブランチ

- `main` にマージ → Vercel が自動で本番 (`priority-todo-neon.vercel.app`) にデプロイ
- 作業は feature ブランチで。PR 経由で `main` に取り込む
- `main` への直接 push は禁止
- `git push --force` / `reset --hard` は破壊的なので**ユーザーに確認してから**

## 6. コード品質

- TypeScript strict は維持。`any` 逃げは避ける
- `npm run build` が通らない変更はマージ不可
- 依存追加は最小限。理由を PR に書く

## 7. 作業スタイル

- 個人向け Next.js アプリ。過剰な抽象化・将来の拡張を見越した設計は避ける
- UI 変更は動作確認前提。自動テストはまだ無いので、変更の影響範囲を説明する
- 日本語で応答。コミットメッセージは英語でも日本語でも可
- 作業開始前に `AI_RULES.md`、`WORKFLOW.md`、`docs/work-plan.md`、`docs/phase-implementation-roadmap.md` を参照する
- 実装作業のフェーズ進行、PR 作成、マージ、報告は `WORKFLOW.md` に従う
