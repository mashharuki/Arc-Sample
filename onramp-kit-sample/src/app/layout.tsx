import type { ReactNode } from "react";

export const metadata = { title: "OnRamp Kit 実験場", description: "Arc OnRamp Kit 学習用サンプル" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: 16 }}>
        {children}
      </body>
    </html>
  );
}
