# sdk-sample

## 動かし方

### To install dependencies:

```bash
bun install
```

### 環境変数のセットアップ

```bash
cp .env.example .env
```

APIキーはCircleコンソールで作成しセットする

### エンティティシークレットの生成および登録

```bash
bun run generate
```

以下のように生成される

```bash
================================================================
!!!! ENTITY SECRET: <ここに出力される> !!!!
================================================================
```

これを以下のコマンドを実行して登録する

```bash
bun run register 
```

バックアップファイルが生成されるので保管しておくこと！

### Walletの作成

```bash
bun run createWallet
```

```json
{
  walletData: [
    {
      id: "30cb80df-7b3d-5e4a-86c8-36bb11b77cc9",
      state: "LIVE",
      walletSetId: "e8e41a4b-fd7f-5f15-9293-3806f2fbb189",
      custodyType: "DEVELOPER",
      address: "0x22e24e551daa46183e5b41db72a54922f816c449",
      blockchain: "ARC-TESTNET",
      accountType: "EOA",
      updateDate: "2026-01-31T13:50:55Z",
      createDate: "2026-01-31T13:50:55Z",
    }, {
      id: "5a6fc874-3233-5fbd-bb92-7f7417b604c6",
      state: "LIVE",
      walletSetId: "e8e41a4b-fd7f-5f15-9293-3806f2fbb189",
      custodyType: "DEVELOPER",
      address: "0x7b6314ea59b46e4db01d882964c5ded58477f3ad",
      blockchain: "ARC-TESTNET",
      accountType: "EOA",
      updateDate: "2026-01-31T13:50:55Z",
      createDate: "2026-01-31T13:50:55Z",
    }
  ],
}
```

### Walletの残高確認

```bash
bun run getBalance
```

```bash
=== WALLET_ID1の残高 ===
{
  "tokenBalances": []
}
=== WALLET_ID2の残高 ===
{
  "tokenBalances": []
}
```

### USDCの送金

```bash
bun run transfer
```

```bash
{
  id: "65aa2774-df57-5d8a-a1d0-bc1eaeccaa2f",
  state: "INITIATED",
}
{
  transaction: {
    id: "65aa2774-df57-5d8a-a1d0-bc1eaeccaa2f",
    blockchain: "ARC-TESTNET",
    tokenId: "15dc2b5d-0994-58b0-bf8c-3a0501148ee8",
    walletId: "30cb80df-7b3d-5e4a-86c8-36bb11b77cc9",
    sourceAddress: "0x22e24e551daa46183e5b41db72a54922f816c449",
    destinationAddress: "0x7b6314ea59b46e4db01d882964c5ded58477f3ad",
    transactionType: "OUTBOUND",
    custodyType: "DEVELOPER",
    state: "INITIATED",
    transactionScreeningEvaluation: {
      screeningDate: "2026-01-31T14:15:00Z",
    },
    amounts: [ "0.1" ],
    nfts: null,
    networkFee: "",
    operation: "TRANSFER",
    feeLevel: "MEDIUM",
    refId: "",
    abiParameters: null,
    createDate: "2026-01-31T14:14:59Z",
    updateDate: "2026-01-31T14:15:00Z",
  },
}
```

しばらく待ってから残高情報を取得すると変わっているはず