import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  getContract,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG, GATEWAY_WALLET_ADDRESS, parseBalance } from "./utils";

const {
  WORLDCHAIN_RPC_URL,
  WORLDCHAIN_DEPOSIT_PRIVATE_KEY,
  DEPOSIT_AMOUNT_USDC,
} = process.env;

/**
 * deposit USDC into the World Chain gateway wallet
 */
const main = async () => {
  if (!WORLDCHAIN_RPC_URL) {
    throw new Error("WORLDCHAIN_RPC_URL is required");
  }
  if (!WORLDCHAIN_DEPOSIT_PRIVATE_KEY) {
    throw new Error("WORLDCHAIN_DEPOSIT_PRIVATE_KEY is required");
  }

  const depositAmountUsdc = DEPOSIT_AMOUNT_USDC ?? "0.1";
  const amountBaseUnits = parseBalance(depositAmountUsdc);

  const account = privateKeyToAccount(
    WORLDCHAIN_DEPOSIT_PRIVATE_KEY as `0x${string}`,
  );

  const worldchain = {
    id: 4801,
    name: "World Chain Sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [WORLDCHAIN_RPC_URL] } },
  };

  const publicClient = createPublicClient({
    chain: worldchain,
    transport: http(WORLDCHAIN_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: worldchain,
    transport: http(WORLDCHAIN_RPC_URL),
  });

  const usdcAddress = CHAIN_CONFIG.worldchain.usdc as `0x${string}`;

  const usdc = getContract({
    address: usdcAddress,
    abi: erc20Abi,
    client: { public: publicClient, wallet: walletClient },
  });

  // deposit into gateway wallet
  const gatewayWallet = getContract({
    address: GATEWAY_WALLET_ADDRESS as `0x${string}`,
    abi: [
      {
        type: "function",
        name: "deposit",
        inputs: [
          { name: "token", type: "address" },
          { name: "value", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ] as const,
    client: { public: publicClient, wallet: walletClient },
  });

  // 残高取得する
  const balance = await usdc.read.balanceOf([account.address]);
  if (balance < amountBaseUnits) {
    throw new Error(
      `Insufficient USDC balance: have ${balance}, need ${amountBaseUnits}`,
    );
  }

  // approve USDC transfer to gateway wallet
  const approveTx = await usdc.write.approve(
    [GATEWAY_WALLET_ADDRESS as `0x${string}`, amountBaseUnits],
    { account },
  );
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`Approve tx: ${approveTx}`);

  // deposit USDC into gateway wallet
  const depositTx = await gatewayWallet.write.deposit(
    [usdcAddress, amountBaseUnits],
    { account },
  );
  await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log(`Deposit tx: ${depositTx}`);
};

main().catch((error) => {
  console.error("\nError:", error?.response?.data ?? error);
  process.exit(1);
});
