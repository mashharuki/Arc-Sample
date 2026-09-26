import { createMockOnrampServerKit } from "@circle-fin/onramp-kit/mocks";
import { createOnrampServerKit } from "@circle-fin/onramp-kit/server";
import { getMode, ONRAMP_ENDPOINTS } from "./mode";

/** サーバ kit を生成する。apiKey は絶対にブラウザへ渡さない。 */
export function createServerKit() {
  const mode = getMode();
  if (mode === "mock") return createMockOnrampServerKit();

  // APIキーの取得
  const apiKey = process.env.ONRAMP_API_KEY;
  if (!apiKey) throw new Error("ONRAMP_API_KEY が未設定です (.env.local を確認)");

  const ep = ONRAMP_ENDPOINTS[mode];

  // OnrampServerKit を作成する
  return createOnrampServerKit({
    apiKey,
    baseUrl: ep.api,
    widgetBaseUrl: ep.widget,
    // 信頼できる設定からのみ渡す。クライアント入力や Origin ヘッダから導出しない
    referrerDomain: process.env.ONRAMP_REFERRER_DOMAIN || undefined,
  });
}
