# 実機検証ログ

## 2026-09-26 Phase 0: sandbox へのセッション発行

コマンド: `bun run ./scripts/smoke-session.ts <EOA>`(`ONRAMP_MODE=sandbox`)

結果: **成功**

| 項目 | 観察結果 |
| --- | --- |
| キーの形式 | プレフィックス `TEST_API_KEY`、`:` 区切りで 3 セグメント(`<ENV>_API_KEY:<keyId>:<keySecret>` と一致) |
| 接続先 | `https://api-test.circle.com`(API)/ `https://onramp-sandbox.arc.io`(widget) |
| 応答のフィールド | `destinationWallet`, `traceId`, `sessionToken`(JWT 形式), `expiresAt`, `widgetUrl` |
| `widgetUrl` | `https://onramp-sandbox.arc.io/?sessionToken=…` |

### 矛盾リスト(IMPLEMENTATION_PLAN §1.8)の更新

| # | 結論 |
| --- | --- |
| 1 sandbox の可否 | **利用可能**。TEST キーで `api-test.circle.com` からセッションを発行できた。npm 型定義の「public sandbox なし」コメントは古い可能性が高い |
| 2 env 名 | 発行されたキーは `TEST_API_KEY:…` 形式。SDK は `apiKey` に加工せず渡す。環境変数の名前自体は SDK 側で決まっていない(本アプリは `ONRAMP_API_KEY`) |
| 6 API キーと kit key の違い | 今回使ったのは `TEST_API_KEY` 形式の API キーで、`createOnrampServerKit({ apiKey })` が受理した。kit key(`KIT_KEY:…`)との違いは未確認 |
| 1 の補足(NDA) | Early Access NDA を経ずに(または同意済みで)キー発行・セッション発行ができた。NDA が必須条件かは依然として不明 |

### 未検証(次に確認する)

- ブラウザでの実ウィジェット表示(iframe、CSP、`referrerDomain` 要否、localhost で動くか)
- イベントの実ペイロード(`INITIALIZATION_SUCCESS` など)
- セッションの実際の有効時間(`expiresAt` は得たが、発行時刻を記録していないため TTL は未算出。docs は 30 分)
- 応答に `sessionId` が含まれていなかった(mock は含む)。クライアント側 `widget.sessionId` の由来は未確認

## 2026-09-26 Phase 2: 認可・エラー・セッション有効期間

環境: `ONRAMP_MODE=sandbox`、`next dev`(localhost:3000)、curl で検証

| 検証 | 結果 |
| --- | --- |
| 同一オリジン + 正規キー | 200。応答は `destinationWallet, traceId, sessionToken, expiresAt, widgetUrl` |
| Origin ヘッダなし | 401(`authorize` が fail-closed で拒否) |
| `?fault=invalid-key`(不正な API キー) | **400**、`code: 1907`、`name: INPUT_INVALID_API_KEY`、`type: INPUT`。docs のエラー表(1907 = INPUT_INVALID_API_KEY)と一致。サーバ側 `onError` でも記録された |
| セッション有効期間 | 発行時刻 13:03:40 UTC に対し `expiresAt` が 13:33:30 UTC で、約 30 分。docs の記載と一致 |

自動テスト(`bun run test`、mock モード): 7 件成功(`isSameOrigin` 3 件、ルート 4 件: 200 / 別オリジン 401 / 宛先なし 400 / GET 405)。

### 検証の注意
- 初回の curl で正規キーが 400 になったが、原因はテスト用シェル(zsh で変数のヘッダが分割されない)で、アプリの不具合ではなかった。ヘッダを直接渡すと 200。
- 動作確認で `pkill -f "next dev"` を実行し、起動中の dev サーバを誤って停止した。以後はプロセスを名指しで停止しない。

### 未検証
- `onSessionExpired` の再発行フロー(30 分待つか、短いセッションが必要)
- 実ウィジェットのイベントペイロード(`INITIALIZATION_SUCCESS` など)の中身

## 2026-09-26 Phase 2 続き: 実ウィジェットのイベント(sandbox, iframe, localhost)

環境: `/lab/iframe`、`referrerDomain` 空、sandbox ウィジェット。KYC はテスト値で通過し、銀行振込(BankTransfer)で 50 USDC を送信した。

### 観察結果

| 観察 | 内容 |
| --- | --- |
| 表示 | localhost + `referrerDomain` 空で、iframe は正常に表示された(CSP・高さも問題なし) |
| `INITIALIZATION_SUCCESS` | 1 回のウィジェット起動につき **2 回** 発火した(`event` と `code` はどちらも `INITIALIZATION_SUCCESS`) |
| `DEPOSIT_SUBMITTED` | 1 回発火。payload は `{ amount: 50, tokenSymbol: "USDC", paymentMethod: "BankTransfer", settlementExpected: false, orderId: "<uuid>" }` |
| `DEPOSIT_SETTLED` | **今回のログには出ていない**(下記の未検証を参照) |
| 同一 `orderId` | 22:09:00 / 22:09:08 / 22:09:28 の 3 回の送信で、`orderId` が同じ値だった |
| payload に含まれなかったもの | `transactionHash`、`errorMessage`、`canRetry`(docs は「一般的な payload フィールド」として列挙) |

### 解釈(推測を含む。確認済みの事実と区別する)

- **確認済み**: `DEPOSIT_SUBMITTED` の payload の実際の形。`paymentMethod` は `"BankTransfer"`。`settlementExpected` というフィールドが存在する(docs のフィールド列挙には無かった)。
- **確認済み**: `INITIALIZATION_SUCCESS` は複数回届きうる。ハンドラは冪等にする必要がある。
- **未確認**: 2 回発火する理由(ウィジェット内部の画面遷移による再初期化か、SDK 側の挙動か)。本アプリの購読は `widget.on("*")` の 1 つだけで、`DEPOSIT_SUBMITTED` は 1 回だったため、重複購読が原因とは考えにくい。
- **未確認**: `settlementExpected: false` の意味。銀行振込では即時に決済されない、という意味かもしれないが、公式の説明は確認できていない。
- **未確認**: 3 回の送信で `orderId` が同じだった理由(同じ注文の再送か、sandbox が同じ ID を返すのか)。どちらにせよ、注文の重複判定は `orderId` で行うべき。

### 未検証
- `DEPOSIT_SETTLED` がいつ届くか(銀行振込は sandbox で決済されない可能性がある。カード決済で試す価値がある)
- `DEPOSIT_NOT_COMPLETED` の各コード
- Circle 側の webhook(`onramp.deposit.settled`)が届くか

## 2026-09-26 カード決済が選べない

- 実測: sandbox のウィジェットで選べたのは銀行振込のみ。カード決済は選択不可(`referrerDomain` は空、KYB は未実施)。
- docs の記載: デビットカード・Apple Pay・Google Pay は KYB 完了が必要で、セッション作成時に `referrerDomain` を渡す必要がある。銀行振込は KYB の要件が明記されていない。クレジットカードは非対応。
- 未確認: sandbox でも KYB が必須か。`referrerDomain` だけで足りるか。localhost を `referrerDomain` に指定できるか。
- 修正: README で「`referrerDomain` は空でよい」としていた記述を、「銀行振込だけなら空でよい。カード系には必須」に訂正した。

## 2026-09-26 Circle Console の OnRamp Kit セットアップ画面(ユーザー提供の文面)

- Testnet キーは「sandbox でフルの購入フローを実行でき、実資金は動かない」と案内されている。本アプリで使っている `TEST_API_KEY` に該当する。
- 本番(Mainnet)では、Console を Mainnet に切り替えて「本番ドメインを登録」し、live キーを作成する。Testnet 側でドメイン登録や KYB を求める記述は、この文面には無い。
- 「Arc and other supported chains」と記載があり、Arc 以外のチェーンにも対応する可能性がある(未検証)。
- 見立て(未検証): sandbox でカード決済が選べない原因は、KYB ではなく `referrerDomain` の未指定かもしれない。次にトンネルのホスト名を `ONRAMP_REFERRER_DOMAIN` に設定して確認する。
