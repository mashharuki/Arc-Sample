/**
 * 同一オリジンからのリクエストだけを許可する (CSRF 対策の最低限)。
 * ユーザー認証ではない。実アプリでは自前のセッション認証に置き換えること。
 * fail-closed: Origin が無い、または Host と一致しなければ拒否する。
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
