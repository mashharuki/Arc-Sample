# OnRamp Kit 徹底理解サンプルアプリ 実装計画書

作成日: 2026-09-26 / 対象: Arc OnRamp Kit (`@circle-fin/onramp-kit` v1.0.2, App Kit の一部)

## 0. 目的とゴール

| 目的 | 達成の定義 (Definition of Done) |
| --- | --- |
| OnRamp Kit の仕組み・機能・アーキテクチャの徹底理解 | 「サーバ/クライアント/プロトコル」の3層を、コード・図・README で他人に説明できる |
| Arc の概要理解 | README に Arc の設計 (USDC ガス, 決定的ファイナリティ, 18/6 decimals 問題) を一次情報付きで整理 |
| App Kit 入門 | OnRamp が App Kit の 6 モジュールの中でどこに位置し、standalone との差は何かを実コードで比較 |
| Arc House 応募材料 | ブログ/登壇に転用できる成果物一式 (§9) |

成果物: ソースコード / README (徹底解説) / draw.io 構成図 / mermaid 処理フロー / 検証ログ。
作業ディレクトリ: **`onramp-kit-sample/`** (新規。既存の `contract-sample/`, `sdk-sample/` には触れない)。

## 1. 一次情報の調査結果 (2026-09-26 時点)

### 1.1 OnRamp Kit とは

- 法定通貨で **USDC / EURC (Arc 上)** を購入する埋め込みウィジェット。KYC・決済・決済完了までを Circle/Arc のホスト側が担う。**wallet adapter 不要** (指定アドレスへ直接入金)。
- 決済手段: デビットカード, Apple Pay, Google Pay, 銀行振込 (米/欧の一部)。地域: 米, 英, EU 一部 (KYB 完了で拡張)。
- セッション有効期間 30 分。iframe / popup の 2 モード。

### 1.2 アーキテクチャ (3 コンポーネント)

1. **Backend**: API キーで per-user の短命 `sessionToken` を発行 (`createOnrampServerKit` / `createSessionRouteHandler`)。API キーはブラウザに出さない。
2. **Frontend**: セッションを受け取り `mountIframe` / `openWindow` でウィジェットを起動。
3. **Widget (onramp.arc.io)**: KYC・決済・入金。`postMessage` でライフサイクルイベントを通知。

パッケージ構成 (npm tarball を実際に展開して確認済み):

| import | 実行場所 | 役割 |
| --- | --- | --- |
| `@circle-fin/onramp-kit/server` | Node | apiKey → sessionToken |
| `@circle-fin/onramp-kit` | Browser | `createOnrampKit`, `fetchOnrampSession`, mount |
| `@circle-fin/onramp-kit/protocol` | 両方 | イベント封筒, セッション型, 定数 (`ONRAMP_EVENT_TYPES/CODES`) |
| `@circle-fin/onramp-kit/mocks` | テスト | server/client のインメモリ mock |

依存: `zod 3.25.67`, `pino 10.1.0`。Node >= 20 (docs quickstart は 22+)。

### 1.3 セッション

`createSession({ appUserId, destinationAddress, assets? })`。`assets` は `tokens` / `chains` / `pairs` (AND 条件, 表示のみの絞り込み)。返却は `{ sessionToken, widgetUrl, expiresAt(RFC3339) }`。`referrerDomain` は **サーバ kit のコンストラクタ引数** (iframe の frame-ancestor 許可リスト。ホスト名のみ、scheme/port/path/wildcard 不可。popup/トップレベルでは不要)。

### 1.4 イベントとエラー

- イベント: `INITIALIZATION_SUCCESS` / `INITIALIZATION_ERROR` (`PAGE_NOT_LOADED`, `INVALID_SESSION_TOKEN`) / `DEPOSIT_SUBMITTED` / `DEPOSIT_SETTLED` / `DEPOSIT_NOT_COMPLETED` (`SESSION_TIMEOUT`, `CANCELED_BY_CUSTOMER`, `NO_PAYMENT_OPTIONS`, `CUSTOMER_PENDING_REVIEW`, `CUSTOMER_REJECTED`, `PAYMENT_PROVIDER_ERROR`)。payload 例: `amount, tokenSymbol, paymentMethod, orderId, transactionHash, errorMessage, canRetry`。
- 購読: 型付きコールバック / `widget.on(name)` / `widget.on('*')`。閉じたスキーマで検証しない (前方互換)。`onSessionExpired` で再発行導線。`widget.close()` 必須。
- `KitError`: `type` (INPUT/NETWORK/SERVICE/RATE_LIMIT/RPC/UNKNOWN) × `recoverability` (RETRYABLE/RESUMABLE/FATAL)。HTTP 写像 400/504/502/429/500。コード 1907, 1910, 1914, 8923。
- **ブラウザイベントは best-effort。最終確定は Circle のサーバ側 webhook** (公式 README に明記)。

### 1.5 ホスティング要件

- CSP: 本番 `frame-src https://onramp.arc.io; connect-src https://onramp.arc.io https://api.circle.com`。sandbox は `onramp-sandbox.arc.io` / `api-test.circle.com`。
- iframe コンテナは DOM 接続済み + 明示的な非 0 高さ (720px 推奨)。iOS Safari は ITP により popup 推奨。popup は同期的な user gesture 内で呼ぶ (`blocked` 理由: `popup_blocked` / `in_app_browser` / `pwa_standalone`)。

### 1.6 Arc の要点

L1 (Malachite BFT, 約 0.48s ブロック, 決定的ファイナリティ), USDC がネイティブガス, EVM 互換, Testnet Chain ID `5042002`, USDC `0x3600…0000` (ネイティブ 18 decimals / ERC-20 IF 6 decimals), EURC `0x89B5…D72a`, Explorer `explorer.testnet.arc.io`, Faucet `faucet.circle.com`。Privacy (APS), USYC, 耐量子署名にも言及あり。

### 1.7 参考実装

- `circlefin/onramp-kit-demo` (Next.js + MetaMask, `POST /api/onramp/session`)
- `circlefin/arc-fintech` PR #47 (Developer-Controlled Wallet 宛て Add Funds, 共有 `KIT_KEY`, `onramp.deposit.settled` webhook を Console の DCW subscription で有効化)
- `akelani-circle/arc-escrow`, `arc-p2p-payments-public` (Onramp 統合 PR)

### 1.8 ⚠️ 未解決の矛盾 (Phase 0 で実機検証して決着させる)

| # | 矛盾 | 影響 | 検証方法 |
| --- | --- | --- | --- |
| 1 | docs/demo は sandbox (`onramp-sandbox.arc.io`) を案内。一方 npm の型定義コメントは "No public sandbox exists today" | キー無しで動かせるか | Console で kit key 発行を試す。デモは Early Access NDA 同意が必要 |
| 2 | env 名がバラバラ: `CIRCLE_API_KEY` / `ONRAMP_API_KEY` / `ONRAMP_KIT_KEY` / `KIT_KEY`。デモ README は旧名 `@crcl-main/onramp-kit` | 設定ミス | 実際に発行できるキーで確認し、README に正式名を固定 |
| 3 | App Kit 経由 (`createAppServerKit` + `kit.onramp.fetchSession`) と standalone (`createOnrampServerKit` + `fetchOnrampSession`) の 2 系統 | どちらを主軸にするか | 両方実装して差分表を作る (§4 Phase 3) |
| 4 | Node 要件 20 vs 22 | CI/実行環境 | 22 を採用 |
| 5 | webhook の署名検証仕様・ペイロードが公式 docs 未確認 | Phase 4 の設計 | Console の DCW webhook docs と実受信で確認。未確認の間は「署名検証 = TODO(要確認)」と明記し推測で実装しない |
| 6 | `apiKey` の受け入れ形式 (`<ENV>_API_KEY:<id>:<secret>`) と kit key の違い | 認証 | 実機で確認 |

## 2. 全体設計

**題材**: 「Arc Treasury Top-up」— ユーザーが法定通貨で Arc Testnet 上の自分のウォレットへ USDC/EURC をチャージし、ブラウザイベントと webhook の両方で入金を追跡・突合する学習用アプリ。単なるデモではなく「OnRamp の全挙動を観察できる実験場 (Lab)」を狙う。

**技術選定**: Next.js (App Router) + TypeScript / bun (既存 `sdk-sample` に合わせる) / viem (Arc 残高取得) / vitest (mocks 利用) / Tailwind。DB は SQLite (`bun:sqlite`) で十分 (webhook 突合ストア)。

**モード切替 (重要)**: `ONRAMP_MODE=mock | sandbox | production`
- `mock`: `@circle-fin/onramp-kit/mocks` で外部依存ゼロ動作。矛盾 #1 (キー/NDA) に阻まれても全機能が学習・レビュー可能。
- `sandbox`: 実ウィジェット (`onramp-sandbox.arc.io`)。
- `production`: 実装のみ、実行は非推奨。

### ページ / API 構成

| 種別 | パス | 学習テーマ |
| --- | --- | --- |
| Page | `/` | 概要 + アーキ図へのリンク |
| Page | `/lab/iframe` | `mountIframe`, コンテナ高さ, CSP |
| Page | `/lab/popup` | `openWindow`, `blocked` 3 理由のフォールバック |
| Page | `/lab/events` | `on('*')` 全イベントタイムライン + payload 表示 |
| Page | `/lab/errors` | KitError 分類, 不正 API キー/期限切れ/引数不正の再現 |
| Page | `/lab/assets` | `assets` の tokens/chains/pairs 絞り込みと AND 動作 |
| Page | `/wallet` | viem で Arc Testnet の USDC 残高 (18/6 decimals 解説付き) |
| Page | `/reconcile` | ブラウザイベント vs webhook の突合ビュー |
| API | `POST /api/onramp/sessions` | `createSessionRouteHandler` + `authorize` + `onError` |
| API | `POST /api/onramp/sessions-appkit` | App Kit 版 (差分比較用) |
| API | `POST /api/webhooks/circle` | webhook 受信 (§4 Phase 4) |

## 3. ディレクトリ構成 (作成予定)

```
onramp-kit-sample/
├── README.md                     # 徹底解説 (§6)
├── .env.example
├── package.json / tsconfig.json / next.config.ts   # CSP ヘッダは next.config で定義
├── src/
│   ├── app/                      # 上記ページ/API
│   ├── lib/onramp/{server.ts,client.ts,events.ts,errors.ts,mode.ts}
│   ├── lib/arc/{chain.ts,balance.ts}      # defineChain(5042002), USDC 残高
│   ├── lib/store/{db.ts,reconcile.ts}
│   └── components/{OnrampFrame,EventTimeline,ErrorPanel,AssetPicker}.tsx
├── tests/                        # vitest + onramp-kit/mocks
├── docs/
│   ├── IMPLEMENTATION_PLAN.md    # 本書
│   ├── architecture.drawio       # §7
│   ├── flows.md                  # mermaid §8
│   ├── research-notes.md         # 一次情報の出典・取得日・確度
│   └── verification-log.md       # 実機検証ログ (矛盾 #1-6 の決着)
└── scripts/{smoke-session.ts,decode-events.ts}
```

## 4. フェーズ計画

各フェーズ末に検証 (コマンド実行結果を `verification-log.md` に貼る) してから次へ進む。

### Phase 0 — 環境と矛盾の決着 (最優先, 実機依存)
- 作業: Console で API/kit key 発行を試行、`onramp-kit-demo` を clone して sandbox 起動、§1.8 の #1,#2,#6 を確定。
- 判断: sandbox が使えなければ `mock` 主軸で Phase 1 以降を進め、README に「実機未検証範囲」を明示。
- 完了条件: `verification-log.md` に各矛盾の結論と証跡。
- **ユーザー作業が必要**: Circle Console アカウント/キー, Early Access NDA 同意。

### Phase 1 — 最小縦切り (server → client → widget)
- `POST /api/onramp/sessions` と `/lab/iframe`。`referrerDomain`・CSP・720px コンテナを実装。
- 完了条件: mock で INITIALIZATION_SUCCESS → DEPOSIT_SETTLED まで表示。sandbox 可なら実ウィジェット表示。

### Phase 2 — イベント/エラー/セッション運用
- `/lab/events` (`on('*')` + 型付きコールバック並記)、`onSessionExpired` 再発行、`widget.close()` の React cleanup、`/lab/errors` (1907/1910/1914/8923 と HTTP 写像)、`authorize` (簡易 cookie セッション) と `onError` ロギング (pino)。
- 完了条件: 全 5 イベント + 6 種の NOT_COMPLETED コードを mock で再現できる。

### Phase 3 — popup / assets / App Kit 比較
- `/lab/popup` の `blocked` 分岐 (iOS Safari・in-app browser を UA で疑似再現)、`/lab/assets` の AND 動作、App Kit 版ルート実装。
- 成果: 「standalone vs App Kit」比較表 (バンドルサイズ, API 名, env 名) を README に。

### Phase 4 — Webhook とファイナリティ突合 (設計上の核)
- 目的: 「ブラウザイベントは UX、真実は webhook」を実証。
- 実装: `POST /api/webhooks/circle` → SQLite に保存 → `/reconcile` で `orderId`/`transactionHash` を軸に突合。さらに viem で Arc の該当 tx を取得し (決定的ファイナリティのため確認待ち不要) 残高差分を照合。
- 「タブを閉じて DEPOSIT_SETTLED を落とす」実験手順を README に記載。
- 制約: 署名検証は §1.8 #5 が確定するまで実装しない (推測実装は禁止)。未確定なら受信・保存のみ + 明示的 TODO。

### Phase 5 — テストと品質
- vitest: セッションルート (405/400/401/各 KitError 写像), `assets` スキーマ, イベント reducer, 突合ロジック。
- 完了条件: `bun test` 全通過, `tsc --noEmit`, `next build` 成功。UI は Playwright か手動でブラウザ確認 (mock モード)。

### Phase 6 — ドキュメント/図/公開物
- §6-§8 を作成。README 内のコマンドを全て実行して再現性を確認。

## 5. 学習を深めるための実験リスト (README「実験」章にする)

1. `referrerDomain` を空/誤りにして iframe が失敗する挙動を観察 (CSP との違い: 「自ページが onramp を枠に入れる許可」対「onramp 内部 iframe が自ページを祖先と認める許可」)。
2. CSP を外して「エラーイベント無しで無言失敗」することを確認。
3. コンテナ高さ 0 で iframe が潰れる。
4. セッションを 30 分放置 → `SESSION_TIMEOUT` → `onSessionExpired`。
5. popup を await 後に開いて `popup_blocked` を再現。
6. `DEPOSIT_SUBMITTED` 後にタブを閉じ、webhook 側でのみ確定を確認。
7. `assets` に矛盾する 2 条件を与え空になる (AND) ことを確認。
8. Arc の 18/6 decimals 差でバグる例と正しい変換。

## 6. README 構成 (徹底解説)

1. 30 秒サマリと全体図 / 2. Arc 入門 (一次情報付き) / 3. App Kit 6 モジュールと OnRamp の位置づけ / 4. OnRamp の 3 層アーキテクチャ / 5. セッション設計とセキュリティ境界 (apiKey・referrerDomain・authorize) / 6. iframe vs popup / 7. イベントとエラー全表 / 8. Webhook が真実である理由 / 9. 実行方法 (mock/sandbox) / 10. 実験集 / 11. 落とし穴 (§1.5, §5) / 12. 未検証事項と矛盾の決着 / 13. 出典一覧 (取得日付き)。

## 7. draw.io 構成図 (`architecture.drawio`)

- **Page 1 システム全体**: Browser (App, SDK client, iframe) / App Server (Next.js route, server kit, SQLite) / Circle API (`api(-test).circle.com`) / Onramp Widget (`onramp(-sandbox).arc.io`) / Payment Provider (KYC/決済) / Arc Network (USDC/EURC) / Circle Console (webhook subscription)。信頼境界を色分け (apiKey が越えられない線を明示)。
- **Page 2 モジュール構成**: `onramp-kit` の server/client/protocol/mocks と App Kit 版の対応。
- **Page 3 デプロイ/CSP**: origin と `frame-src`/`connect-src`/`referrerDomain` の関係。
- 生成は draw.io XML を直接出力し、`drawio` CLI があれば PNG 化して README に埋め込む。

## 8. mermaid 処理フロー (`flows.md`)

1. **sequenceDiagram**: 正常系 (session mint → mount → KYC → 決済 → DEPOSIT_SUBMITTED → Arc 着金 → DEPOSIT_SETTLED + webhook)。
2. **stateDiagram-v2**: ウィジェット状態遷移 (init → ready → submitted → settled / not_completed[6 codes] / expired)。
3. **flowchart**: iframe/popup 選択と `blocked` フォールバック判定木。
4. **flowchart**: エラー分類 (`type` × `recoverability` → 対応)。
5. **sequenceDiagram**: ブラウザイベント欠落時の webhook 突合。

## 9. Arc House 応募への接続

- Architects プログラムは「応募制ではなく貢献でポイントが貯まる」と公式ブログ/Resource にある (roles: Community Moderator, Meetup Organizer, Technical Speaker, Regional Lead ほか。**各ロールの要件は https://community.arc.io/public/resources/architects-roles で要再確認**。検索要約のみで未精読)。
- 転用物: ①本リポジトリ (OSS) ②日本語の徹底解説記事 (矛盾 §1.8 と実験集は差別化になる) ③ハンズオン用スライド (marp) ④Arc 日本語コミュニティ向け勉強会シナリオ。
- 上記は Phase 6 完了後に別途作成 (本計画の対象外)。

## 10. MCP / Skill の扱い

| 項目 | 判断 | 理由 |
| --- | --- | --- |
| Skill `use-onramp-kit` | **作成済み** (`.claude/skills/use-onramp-kit/SKILL.md`) | `.agents/skills` の Circle skill 群に OnRamp が無い。検証済み事実と落とし穴を次回以降のセッションで再利用 |
| MCP サーバ | **作らない** | 参照先は `https://docs.arc.io/llms.txt` で機械可読に取得でき、追加サーバの保守コストに見合わない。必要になれば Phase 4 の webhook 検証用にローカル CLI (`scripts/`) で十分 |
| 既存 skill の活用 | `use-arc`, `use-developer-controlled-wallets`, `use-usdc` を Phase 3-4 で参照 | DCW 宛て入金 (arc-fintech 方式) を試す場合 |

## 11. リスクと対応

| リスク | 対応 |
| --- | --- |
| sandbox/キー/NDA で実機が動かない | `mock` モード主軸 + 実機未検証を README で明示 |
| Early Access 段階で API が変わる (v1.0.2 で `destinationWallet` param が削除された実績) | バージョン固定, CHANGELOG 監視, 出典に取得日を記載 |
| 秘密情報の混入 | `.env` は gitignore, `.env.example` のみコミット |
| 推測による誤記 | 未確認事項は「要確認」と書き、確認後に更新 |

## 12. 決定事項 (2026-09-26 ユーザー回答)

- 入金先: **EOA (MetaMask 等)** を採用。DCW は対象外。
- UI 言語: **日本語のみ**。
- Console の API/kit key・Early Access NDA: **未取得**。よって Phase 0 は「取得手順の確認」から始め、取得完了までは **`mock` モード主軸**で Phase 1 以降を進める。
- 取得先の手がかり (要実機確認): API key `https://console.circle.com/api-keys` / KYB `https://console.circle.com/app-kits/` / デモの同意項目 = Early Access NDA・Developer Terms・Privacy Policy。

## 12'. (旧) 着手前に確認したかったこと

1. Circle Console の API/kit key と Early Access NDA 同意は済んでいますか (Phase 0 で実機検証できるか、`mock` 主軸にするかが決まります)。
2. 入金先は **MetaMask 等の EOA** と **Circle Developer-Controlled Wallet** (既存 `sdk-sample` 資産を活用) のどちらを主にしますか。既定案は「EOA を主, DCW を Phase 4 の拡張」。
3. UI 言語は日本語のみか、日英併記か (README は日本語主, 英語サマリ併記が既定案)。
