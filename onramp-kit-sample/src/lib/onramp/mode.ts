export type OnrampMode = "mock" | "sandbox" | "production";

export const ONRAMP_ENDPOINTS = {
  sandbox: { api: "https://api-test.circle.com", widget: "https://onramp-sandbox.arc.io" },
  production: { api: "https://api.circle.com", widget: "https://onramp.arc.io" },
} as const;

export function getMode(): OnrampMode {
  const m = process.env.ONRAMP_MODE ?? "mock";
  if (m === "mock" || m === "sandbox" || m === "production") return m;
  throw new Error(`ONRAMP_MODE は mock | sandbox | production のいずれかです: ${m}`);
}
