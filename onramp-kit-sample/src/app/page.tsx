import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>OnRamp Kit 実験場</h1>
      <p>法定通貨で Arc 上の USDC / EURC を購入するウィジェットの挙動を観察するための学習用アプリです。</p>
      <ul>
        <li><Link href="/lab/iframe">iframe モード</Link></li>
        <li><Link href="/lab/errors">エラー実験 (不正な API キー)</Link></li>
      </ul>
    </main>
  );
}
