import { createOnrampServerKit, createSessionRouteHandler } from "@circle-fin/onramp-kit/server";
import { isSameOrigin } from "@/lib/onramp/authorize";
import { ONRAMP_ENDPOINTS } from "@/lib/onramp/mode";
import { createServerKit } from "@/lib/onramp/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 学習用: ?fault=invalid-key で不正な API キーの失敗を実 API で再現する (本番では無効)
  const fault = new URL(request.url).searchParams.get("fault");
  const kit =
    fault === "invalid-key" && process.env.NODE_ENV !== "production"
      ? createOnrampServerKit({ apiKey: "TEST_API_KEY:invalid:invalid", baseUrl: ONRAMP_ENDPOINTS.sandbox.api })
      : createServerKit();

  const handler = createSessionRouteHandler(kit, {
    authorize: (req) => isSameOrigin(req),
    onError: (err) => {
      const e = err as { name?: string; type?: string; code?: number; recoverability?: string };
      console.error("[onramp] session error", { name: e?.name, type: e?.type, code: e?.code, recoverability: e?.recoverability });
    },
  });
  return handler(request);
}
