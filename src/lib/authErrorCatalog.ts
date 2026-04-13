export interface AuthIssue {
  id: number;
  summary: string;
  detail: string;
}

/**
 * ログイン失敗コード一覧
 * - UIには `summary` を表示し、`id` で問い合わせしやすくする
 * - `detail` は運用/サポート向けに原因説明として使う
 */
const CATALOG: Record<string, AuthIssue> = {
  "auth/unauthorized-domain": {
    id: 401,
    summary: "認証ドメインの設定不足",
    detail: "Firebase Authentication の Authorized domains に現在のアクセスドメインが登録されていません。",
  },
  "auth/popup-blocked": {
    id: 402,
    summary: "ポップアップがブロックされました",
    detail: "ブラウザや端末設定によりポップアップが拒否されました。redirect 方式へ切り替えて再試行してください。",
  },
  "auth/popup-closed-by-user": {
    id: 403,
    summary: "ログインポップアップが閉じられました",
    detail: "ユーザー操作またはOS挙動でポップアップが閉じられました。",
  },
  "auth/operation-not-supported-in-this-environment": {
    id: 404,
    summary: "この環境ではログイン方式が未対応です",
    detail: "アプリ内ブラウザ等、制限のある環境で popup が利用できません。",
  },
  "auth/cancelled-popup-request": {
    id: 405,
    summary: "ログイン要求がキャンセルされました",
    detail: "複数回タップなどにより以前の popup 要求がキャンセルされました。",
  },
  "auth/network-request-failed": {
    id: 406,
    summary: "ネットワーク接続エラー",
    detail: "通信エラーにより認証処理に失敗しました。",
  },
};

const FALLBACK_ISSUE: AuthIssue = {
  id: 499,
  summary: "不明なログインエラー",
  detail: "想定外のエラーです。コードと発生条件を記録して調査してください。",
};

export const resolveAuthIssue = (code?: string | null): AuthIssue =>
  (code && CATALOG[code]) || FALLBACK_ISSUE;
