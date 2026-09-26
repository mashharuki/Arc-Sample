---
name: use-onramp-kit
description: Arc OnRamp Kit (@circle-fin/onramp-kit) の実装ガイド。法定通貨で Arc 上の USDC/EURC を購入するウィジェットのセッション発行、iframe/popup 埋め込み、ライフサイクルイベント、CSP、webhook 突合を扱うとき、または "onramp" "add funds" "fiat to USDC on Arc" に言及があるときに使う。
---

# OnRamp Kit 実装ガイド

出典と取得日は `onramp-kit-sample/docs/research-notes.md` (作成予定) と `onramp-kit-sample/docs/IMPLEMENTATION_PLAN.md` §1 を参照。仕様は Early Access で変わりうるので、実装前に https://docs.arc.io/llms.txt の onramp 系ページと `npm view @circle-fin/onramp-kit version` を再確認すること。

## 構成 (3 層)

- Server (`@circle-fin/onramp-kit/server`): `createOnrampServerKit({ apiKey, referrerDomain? })` + `createSessionRouteHandler(server, { authorize, onError })`。apiKey は絶対にブラウザへ出さない。
- Client (`@circle-fin/onramp-kit`): `createOnrampKit()`, `fetchOnrampSession({ url, body })`, `mountIframe` / `openWindow`。
- Protocol / mocks: `/protocol` (イベント定数・型), `/mocks` (テスト用)。
- App Kit 経由の別 API もある: `createAppServerKit({ onramp })` (`@circle-fin/app-kit/server`) と `kit.onramp.fetchSession / mountIframe`。

## 必ず守ること

1. セッション本文は `{ appUserId, destinationAddress, assets? }`。`assets` は表示絞り込みのみ (AND 条件)。
2. `referrerDomain` はサーバ kit のコンストラクタ引数で、信頼できる設定から渡す。ホスト名のみ (scheme/port/path/wildcard 不可)。iframe 埋め込み時のみ必要。
3. CSP: `frame-src` と `connect-src` に widget/API origin (本番 `onramp.arc.io` / `api.circle.com`, sandbox `onramp-sandbox.arc.io` / `api-test.circle.com`)。欠けるとエラー無しで無言失敗する。
4. iframe コンテナは DOM 接続済みかつ明示的な高さ (720px 等)。React では `useEffect` 内で mount し、cleanup で `widget.close()`。
5. `openWindow` は同期的な click ハンドラ内で呼ぶ (await の後は blocked)。`status === 'blocked'` は通常フロー。`in_app_browser` / `pwa_standalone` は `mountIframe` にフォールバック。iOS Safari は popup 推奨。
6. ブラウザイベントは best-effort の UX 信号。入金確定は Circle の webhook (`onramp.deposit.settled` を Console の subscription で有効化) を真実とする。DEPOSIT_SETTLED が来ないことを「入金なし」と扱わない。
7. エラーは `KitError` の `type` と `recoverability` で分岐し、message の文字列解析はしない。
8. セッションは約 30 分で失効。`onSessionExpired` で再発行して再 mount。

## イベント

`INITIALIZATION_SUCCESS`, `INITIALIZATION_ERROR` (`PAGE_NOT_LOADED`, `INVALID_SESSION_TOKEN`), `DEPOSIT_SUBMITTED`, `DEPOSIT_SETTLED`, `DEPOSIT_NOT_COMPLETED` (`SESSION_TIMEOUT`, `CANCELED_BY_CUSTOMER`, `NO_PAYMENT_OPTIONS`, `CUSTOMER_PENDING_REVIEW`, `CUSTOMER_REJECTED`, `PAYMENT_PROVIDER_ERROR`)。未知のイベント/コードも `on('*')` に素通しで届く。

## Arc 側の注意

Testnet Chain ID 5042002。USDC `0x3600000000000000000000000000000000000000` はネイティブ 18 decimals、ERC-20 IF は 6 decimals。残高計算で混同しない。

## 未確認 (推測で実装しない)

- webhook の署名検証方式とペイロード
- sandbox の実利用可否 (docs は案内、npm 型定義コメントは "no public sandbox")
- env 名の正式名 (`CIRCLE_API_KEY` / `ONRAMP_API_KEY` / `KIT_KEY` が資料により異なる)
