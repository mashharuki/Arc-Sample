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
