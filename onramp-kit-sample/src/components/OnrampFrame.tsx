"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createOnrampKit, fetchOnrampSession, KitError } from "@circle-fin/onramp-kit";
import type { OnrampWidget } from "@circle-fin/onramp-kit";

type LogRow = { at: string; event: string; code: string; payload?: unknown };

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
const MAX_REMINT = 2; // 失効時の自動再発行の上限 (無限ループ防止)

export function OnrampFrame({ endpoint = "/api/onramp/sessions" }: { endpoint?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<OnrampWidget | null>(null);
  const remintCount = useRef(0);
  const [address, setAddress] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const push = useCallback((row: Omit<LogRow, "at">) => {
    setLogs((l) => [{ at: new Date().toLocaleTimeString("ja-JP"), ...row }, ...l]);
  }, []);

  // アンマウント時に必ず close (message リスナーと timer を解放)
  useEffect(() => () => widgetRef.current?.close(), []);

  const launch = useCallback(
    async (destinationAddress: string) => {
      widgetRef.current?.close();
      const session = await fetchOnrampSession({
        url: endpoint,
        body: { appUserId: "demo-user", destinationAddress },
      });
      const widgetBaseUrl = process.env.NEXT_PUBLIC_ONRAMP_WIDGET_BASE_URL || undefined;
      const kit = createOnrampKit(widgetBaseUrl ? { widgetBaseUrl } : undefined);
      const widget = kit.mountIframe({
        session,
        container: containerRef.current!,
        // セッション失効 (SESSION_TIMEOUT / INVALID_SESSION_TOKEN) → 新しいセッションで再 mount
        onSessionExpired: async () => {
          if (remintCount.current >= MAX_REMINT) {
            setError("セッションの再発行が上限に達しました。もう一度「購入を開始」を押してください");
            return;
          }
          remintCount.current += 1;
          push({ event: "(app)", code: "SESSION_REMINT", payload: { count: remintCount.current } });
          try {
            await launch(destinationAddress);
          } catch (e) {
            setError(describe(e));
          }
        },
      });
      widget.on("*", (e) => push({ event: e.event, code: e.code, payload: e.payload }));
      widgetRef.current = widget;
    },
    [endpoint, push],
  );

  const start = async () => {
    setError(null);
    remintCount.current = 0;
    if (!isAddress(address)) return setError("0x から始まる 40 桁の EOA アドレスを入力してください");
    try {
      await launch(address);
    } catch (e) {
      setError(describe(e));
    }
  };

  return (
    <section>
      <label>
        入金先 EOA アドレス (Arc Testnet)
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" style={{ width: "100%", padding: 8 }} />
      </label>
      <button onClick={start} style={{ margin: "8px 0", padding: "8px 16px" }}>購入を開始</button>
      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {/* iframe は明示的な高さが必須 (cross-origin iframe は内容に合わせて伸びない) */}
      <div ref={containerRef} style={{ width: "100%", height: 720, border: "1px solid #ccc" }} />
      <h2>イベントログ ({logs.length})</h2>
      <p style={{ color: "#666" }}>これはブラウザ側の best-effort な通知です。入金の確定は webhook で確認します。</p>
      <ol style={{ paddingLeft: 20 }}>
        {logs.map((l, i) => (
          <li key={i}><code>{l.at} {l.event} / {l.code}</code> {l.payload ? <pre>{JSON.stringify(l.payload, null, 2)}</pre> : null}</li>
        ))}
      </ol>
    </section>
  );
}

/** KitError は type / recoverability で分岐する (message の文字列解析はしない) */
function describe(e: unknown): string {
  if (e instanceof KitError) {
    const hint = e.recoverability === "RETRYABLE" ? "時間をおいて再試行できます" : e.recoverability === "RESUMABLE" ? "操作後に続行できます" : "回復できません";
    return `[${e.type} / ${e.recoverability}] ${hint} (code=${e.code}, ${e.name})`;
  }
  return e instanceof Error ? e.message : String(e);
}
