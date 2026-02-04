import { privateKeyToAccount } from "viem/accounts";
import { GATEWAY_API } from "./utils";

const { WORLDCHAIN_BURN_PRIVATE_KEY, WORLDCHAIN_DEPOSIT_PRIVATE_KEY } =
  process.env;

/**
 * メイン関数
 * @returns 
 */
const main = async () => {
  const key = WORLDCHAIN_BURN_PRIVATE_KEY ?? WORLDCHAIN_DEPOSIT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "WORLDCHAIN_BURN_PRIVATE_KEY or WORLDCHAIN_DEPOSIT_PRIVATE_KEY is required",
    );
  }

  const account = privateKeyToAccount(key as `0x${string}`);
  const depositor = account.address;

  // Fetch balance from Gateway API(depositor address on World Chain Sepolia)
  const response = await fetch(`${GATEWAY_API}/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "USDC",
      sources: [
        { domain: 14, depositor },
        { domain: 26, depositor }
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway API error: ${response.status} ${text}`);
  }

  const { balances = [] } = await response.json();
  const entry = balances[0];

  if (!entry) {
    console.log(`World Chain Sepolia: 0.000000 USDC`);
    return;
  }

  const raw = String(entry.balance ?? "0");
  const [whole, decimal = ""] = raw.split(".");
  const amount = `${whole || "0"}.${(decimal + "000000").slice(0, 6)}`;
  console.log(`World Chain Sepolia: ${amount} USDC`);
};

main().catch((error) => {
  console.error("\nError:", error?.response?.data ?? error);
  process.exit(1);
});
