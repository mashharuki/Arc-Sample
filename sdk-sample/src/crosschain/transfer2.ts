import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { client } from "../sdk-config";
import {
  burnIntentTypedData,
  CHAIN_CONFIG,
  formatUnits,
  GATEWAY_API,
  GATEWAY_MINTER_ADDRESS,
  makeBurnIntent,
  parseSelectedChains,
  stringifyTypedData,
  waitForTxCompletion,
} from "./utils";

const {
  DESTINATION_CHAIN,
  TO_ADDRESS,
  TRANSFER_AMOUNT_USDC,
  WORLDCHAIN_RPC_URL,
  WORLDCHAIN_MINT_PRIVATE_KEY,
} = process.env;

const ALLOWED_CHAINS = ["arc", "worldchain"] as const;
type AllowedChain = (typeof ALLOWED_CHAINS)[number];

/**
 * 許可されたチェーンかどうかを検証する
 * @param value 
 */
function assertAllowedChain(value: string): asserts value is AllowedChain {
  if (!ALLOWED_CHAINS.includes(value as AllowedChain)) {
    throw new Error(
      `Unsupported chain: ${value}. Allowed: ${ALLOWED_CHAINS.join(", ")}`,
    );
  }
}

const transferAmountUsdc = Number(TRANSFER_AMOUNT_USDC ?? "0.1");
  
if (!Number.isFinite(transferAmountUsdc) || transferAmountUsdc <= 0) {
  throw new Error("TRANSFER_AMOUNT_USDC must be a positive number");
}

/**
 * メイン処理
 */
const main = async () => {
  // 送信先チェーンの検証と設定取得(デフォルトはworldchain)
  const destinationKeyRaw = (DESTINATION_CHAIN ?? "worldchain").toLowerCase();
  assertAllowedChain(destinationKeyRaw);

  const destinationConfig = CHAIN_CONFIG[destinationKeyRaw];

  const destinationWallet =
    destinationKeyRaw === "worldchain"
      ? null
      : await client.getWallet({
          id: destinationConfig.walletId,
        });

  const destinationWalletAddress =
    destinationWallet?.data?.wallet.address ?? undefined;

  const recipientAddress = TO_ADDRESS ?? destinationWalletAddress;
  if (!recipientAddress) {
    throw new Error("Missing TO_ADDRESS (recipient address)");
  }

  const selectedChains = parseSelectedChains();
  const sourceChains = selectedChains.filter((chain) =>
    ALLOWED_CHAINS.includes(chain as AllowedChain),
  ) as AllowedChain[];

  if (sourceChains.length === 0) {
    throw new Error(
      `No source chains selected. Use: ${ALLOWED_CHAINS.join(", ")}`,
    );
  }

  const domain = { name: "GatewayWallet", version: "1" };
  const requests: Array<{ burnIntent: unknown; signature?: string }> = [];
  const burnIntentsForTotal: Array<{ spec: { value: bigint } }> = [];

  for (const chain of sourceChains) {
    if (chain === destinationKeyRaw) continue;
    if (chain === "worldchain") {
      throw new Error(
        "World Chain Sepolia is not supported as a source chain with Circle Wallets. " +
        "Use Arc as the source chain.",
      );
    }

    const sourceConfig = CHAIN_CONFIG[chain];
    const sourceWallet = await client.getWallet({
      id: sourceConfig.walletId,
    });
    const sourceWalletAddress = sourceWallet.data?.wallet.address ?? undefined;
    if (!sourceWalletAddress) {
      throw new Error(`Failed to resolve wallet address for ${chain}`);
    }

    // 送信元チェーンでburnするためのインテントデータを作成する
    const burnIntent = makeBurnIntent(
      chain,
      destinationConfig.walletChain,
      sourceWalletAddress,
      recipientAddress,
      transferAmountUsdc,
    );

    const typedData = burnIntentTypedData(burnIntent, domain);

    // インテントデータに署名する
    const sigResp = await client.signTypedData({
      walletId: sourceConfig.walletId,
      data: stringifyTypedData(typedData),
    });
    if (!sigResp.data?.signature) {
      throw new Error(`Failed to sign burn intent for ${chain}`);
    }

    // リクエスト用配列に追加する
    requests.push({
      burnIntent: typedData.message,
      signature: sigResp.data?.signature,
    });
    burnIntentsForTotal.push(burnIntent);
  }

  if (requests.length === 0) {
    throw new Error("No burn intents created (source == destination?)");
  }

  // Gateway APIにburnインテントを送信し、アテステーションを取得する
  const response = await fetch(`${GATEWAY_API}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway API error: ${response.status} ${text}`);
  }

  const json = await response.json();
  const attestation = json?.attestation;
  const operatorSig = json?.signature;

  if (!attestation || !operatorSig) {
    throw new Error("Missing attestation or signature in response");
  }

  // 取得したアテステーションを使って、送信先チェーンでmintを実行する
  // 宛先がWorld Chain Sepoliaの場合はviemで直接実行し、それ以外のチェーン(Arcなど)ではSDKを使って実行する
  if (destinationKeyRaw === "worldchain") {
    if (!WORLDCHAIN_RPC_URL) {
      throw new Error("WORLDCHAIN_RPC_URL is required for worldchain mint");
    }
    if (!WORLDCHAIN_MINT_PRIVATE_KEY) {
      throw new Error(
        "WORLDCHAIN_MINT_PRIVATE_KEY is required for worldchain mint",
      );
    }

    // World Chain Sepoliaへのmintはviemを使って直接実行する
    const account = privateKeyToAccount(
      WORLDCHAIN_MINT_PRIVATE_KEY as `0x${string}`,
    );

    const worldchain = {
      id: 4801,
      name: "World Chain Sepolia",
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [WORLDCHAIN_RPC_URL] } },
    };

    // viemクライアントの作成
    const publicClient = createPublicClient({
      chain: worldchain,
      transport: http(WORLDCHAIN_RPC_URL),
    });

    // ウォレットクライアントの作成
    const walletClient = createWalletClient({
      account,
      chain: worldchain,
      transport: http(WORLDCHAIN_RPC_URL),
    });

    // Gatway Minterコントラクトの作成
    const gatewayMinter = getContract({
      address: GATEWAY_MINTER_ADDRESS,
      abi: [
        {
          type: "function",
          name: "gatewayMint",
          inputs: [
            { name: "attestationPayload", type: "bytes" },
            { name: "signature", type: "bytes" },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ] as const,
      client: { public: publicClient, wallet: walletClient },
    });

    // USDCのmintを実行する
    const mintTxHash = await gatewayMinter.write.gatewayMint(
      [attestation, operatorSig],
      { account },
    );
    await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
    console.log(`Mint tx hash (worldchain): ${mintTxHash}`);
  } else {
    // ArcなどのCircle Wallet対応チェーンではSDKを使ってmintを実行する
    const mintTx = await client.createContractExecutionTransaction({
      walletId: destinationConfig.walletId,
      contractAddress: GATEWAY_MINTER_ADDRESS,
      abiFunctionSignature: "gatewayMint(bytes,bytes)",
      abiParameters: [attestation, operatorSig],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const mintTxId = mintTx.data?.id;
    if (!mintTxId) throw new Error("Failed to submit mint transaction");
    await waitForTxCompletion(client, mintTxId, "USDC mint");
  }

  const totalMintBaseUnits = burnIntentsForTotal.reduce(
    (sum, intent) => sum + intent.spec.value,
    0n,
  );
  console.log(
    `Minted ${formatUnits(totalMintBaseUnits, 6)} USDC on ${destinationConfig.chainName}`,
  );
};

main().catch((error) => {
  console.error("\nError:", error?.response?.data ?? error);
  process.exit(1);
});
