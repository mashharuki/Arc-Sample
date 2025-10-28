# Arc-Sample

This repo for testing Arc Testnet

## Arc 

L1 Blocchain
- USDC is native gas token on this blockchain

## How to work

### setup

```bash
cp .env.example .env
```

```txt
ARC_TESTNET_RPC_URL="https://rpc.testnet.arc.network"
PRIVATE_KEY="0x..."
```

### install

```bash
forge install
```

### compile

```bash
forge build
```

### test

```bash
forge test
```

### Deploy contract

```bash
source .env && forge create src/HelloArchitect.sol:HelloArchitect \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

以下のようになればOK!

```bash
[⠊] Compiling...
No files changed, compilation skipped
Deployer: 0x51908F598A5e0d8F1A3bAbFa6DF76F9704daD072
Deployed to: 0xAa363921A48Eac63F802C57658CdEde768B3DAe1
Transaction hash: 0x356b023d3ee37052ad8e7fa96c7601aafb7ee874011b144193de31601367ee08
```

デプロイしたコントラクト

[0xAa363921A48Eac63F802C57658CdEde768B3DAe1](https://testnet.arcscan.app/address/0xAa363921A48Eac63F802C57658CdEde768B3DAe1)

### call contract method

```bash
cast call 0xAa363921A48Eac63F802C57658CdEde768B3DAe1 "getGreeting()(string)" \
  --rpc-url $ARC_TESTNET_RPC_URL
```

以下のようになればOK!

```bash
"Hello Architect!"
```

## 参考文献
- [開発者ドキュメント](https://docs.arc.network/arc/tutorials/deploy-on-arc)
- [テストネット faucet](https://faucet.circle.com/)
- [テストネット ブロックチェーンエクスプローラー](https://testnet.arcscan.app)
- [コントラクトをデプロイしたトランザクション](https://testnet.arcscan.app/tx/0x356b023d3ee37052ad8e7fa96c7601aafb7ee874011b144193de31601367ee08)