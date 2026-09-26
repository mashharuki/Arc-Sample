import { OnrampFrame } from "@/components/OnrampFrame";

// ?fault=invalid-key で不正な API キーを使ったセッション発行の失敗を再現する
export default function ErrorsLab() {
  return (
    <main>
      <h1>エラー実験: 不正な API キー</h1>
      <p>セッション発行 API に <code>?fault=invalid-key</code> を付けて、KitError の分類 (type / recoverability / code) を観察します。</p>
      <OnrampFrame endpoint="/api/onramp/sessions?fault=invalid-key" />
    </main>
  );
}
