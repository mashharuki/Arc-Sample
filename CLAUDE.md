# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ETH Skills

Read https://ethskills.com/SKILL.md and follow it before writing Solidity or shipping anything onchain.

## Overview

Sandbox repo for experimenting with Circle's Arc Testnet (an L1 where USDC is the native gas token). Two independent sub-projects, no root-level build or workspace tooling. README content is largely written in Japanese. `docs/memo.md` holds the planning brief for an Arc App Kit / OnRamp Kit learning sample.

- `contract-sample/` — Foundry project (Solidity). `HelloArchitect.sol` plus its test. `lib/forge-std` is a git submodule (`git submodule update --init` if missing).
- `sdk-sample/` — Bun + TypeScript scripts that use Circle SDKs (`@circle-fin/developer-controlled-wallets`, `@circle-fin/bridge-kit`, `@circle-fin/adapter-circle-wallets`) and `viem`. No test suite or linter is configured.

`.agents/skills/` and `skills-lock.json` hold Circle agent skills (use-arc, use-gateway, bridge-stablecoin, use-developer-controlled-wallets, etc.); consult them for Circle/Arc API questions.

## Commands

### contract-sample (run from `contract-sample/`)

```bash
forge build
forge test
forge test --match-test <testName>   # single test
source .env && forge create src/HelloArchitect.sol:HelloArchitect \
  --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

`.env` needs `ARC_TESTNET_RPC_URL` (https://rpc.testnet.arc.network) and `PRIVATE_KEY`.

### sdk-sample (run from `sdk-sample/`)

Each `package.json` script runs one standalone script with `bun run`; there is no shared entrypoint. `cp .env.example .env` first (`API_KEY` from the Circle console).

```bash
bun install
bun run generate      # create an entity secret -> put in CIRCLE_ENTITY_SECRET
bun run register      # register the entity secret (writes a recovery backup file; keep it)
bun run createWallet && bun run getBalance && bun run transfer
bun run bridge        # Arc -> another chain via Bridge Kit
bun run crosschain:<createWallet|getBalance|getGatewayBalance|deposit|transfer|transfer2|depositWorldchain|getGatewayBalanceWorldchain>
```

## Architecture (sdk-sample)

- `src/sdk-config.ts` is the shared setup. It reads `API_KEY` and `CIRCLE_ENTITY_SECRET` from env (throws if missing) and exports `client` (developer-controlled wallets client) and `adapter` (Circle Wallets adapter for Bridge Kit). Top-level scripts import from it.
- Top-level scripts (`transfer.ts`, `bridge.ts`, ...) operate on Arc Testnet wallets identified by `WALLET_ID1` / `WALLET_ID2`.
- `src/crosschain/` implements Circle Gateway (unified USDC balance across chains): deposit into the Gateway wallet on several testnets, then sign a burn intent (EIP-712 via `client.signTypedData`) per source chain and submit it to mint on a destination chain. `crosschain/utils.ts` holds the chain table (`CHAIN_CONFIG`: chain name, USDC address, wallet ID from `CROSSCHAIN_WALLET_ID*`, Gateway domain), burn-intent/typed-data builders, and tx polling. Source chains are selected via CLI args (`parseSelectedChains`); the destination chain and `TO_ADDRESS` come from the script or env.
- `*-worldchain` scripts and the `WORLDCHAIN_*` env vars use raw private keys and `viem` (Worldchain Sepolia) instead of Circle-managed wallets, so they need `WORLDCHAIN_RPC_URL` and the `WORLDCHAIN_*_PRIVATE_KEY` variables.
- `.env` holds real secrets and must not be committed (`.env.example` lists every variable).
