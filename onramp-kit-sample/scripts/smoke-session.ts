// 実機検証用: API キーで sandbox/production にセッションを発行できるかを確認する。
// 使い方: ONRAMP_MODE=sandbox bun --env-file=.env.local run scripts/smoke-session.ts <宛先EOA>
import { createOnrampServerKit } from "@circle-fin/onramp-kit/server";
import { ONRAMP_ENDPOINTS } from "../src/lib/onramp/mode";

const mode = process.env.ONRAMP_MODE === "production" ? "production" : "sandbox";
const key = process.env.ONRAMP_API_KEY;
const dest = process.argv[2];

if (!key || !dest) {
  console.error("ONRAMP_API_KEY と 宛先アドレス(引数)が必要です");
  process.exit(1);
}
// 秘密は出さず、形式(先頭の環境プレフィックス)だけ表示する
console.log("key prefix :", key.split(":")[0], `(segments=${key.split(":").length})`);
console.log("mode       :", mode, ONRAMP_ENDPOINTS[mode]);

// OnrampServerKit を作成する
const kit = createOnrampServerKit({
  apiKey: key,
  baseUrl: ONRAMP_ENDPOINTS[mode].api,
  widgetBaseUrl: ONRAMP_ENDPOINTS[mode].widget,
});

try {
  // 実際にセッションを発行してみる
  const s = await kit.createSession({ appUserId: "smoke-user", destinationAddress: dest });
  console.log("OK: session minted");
  console.log({ ...s, sessionToken: `${s.sessionToken.slice(0, 8)}…(redacted)`, widgetUrl: s.widgetUrl.replace(/sessionToken=[^&]+/, "sessionToken=…") });
} catch (e: any) {
  console.error("FAILED:", { name: e?.name, type: e?.type, code: e?.code, recoverability: e?.recoverability, message: e?.message });
  process.exit(1);
}
