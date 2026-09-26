import type { NextConfig } from "next";

// sandbox / production の widget・API origin を CSP に許可する。
// 欠けると iframe はエラーイベント無しで無言失敗する (README 参照)。
const widget = process.env.NEXT_PUBLIC_ONRAMP_WIDGET_BASE_URL || "https://onramp.arc.io";
const api = process.env.ONRAMP_API_BASE_URL || "https://api.circle.com";

const csp = [
  `frame-src ${widget}`,
  `connect-src 'self' ${widget} ${api}`,
].join("; ");

const config: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: csp }] }];
  },
};
export default config;
