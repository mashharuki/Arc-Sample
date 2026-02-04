import { client } from "../sdk-config";

const {
  CROSSCHAIN_WALLET_ID1,
  CROSSCHAIN_WALLET_ID2,
  CROSSCHAIN_WALLET_ID3,
  CROSSCHAIN_WALLET_ID4,
  CROSSCHAIN_WALLET_ID5,
  CROSSCHAIN_WALLET_ID6,
} = process.env;

/**
 * メイン関数
 */
const main = async () => {
  // 残高を取得する
  const response = await client.getWalletTokenBalance({
    id: CROSSCHAIN_WALLET_ID1!,
  });

  const response2 = await client.getWalletTokenBalance({
    id: CROSSCHAIN_WALLET_ID2!,
  });

  const response3 = await client.getWalletTokenBalance({
    id: CROSSCHAIN_WALLET_ID3!,
  });

  const response4 = await client.getWalletTokenBalance({
    id: CROSSCHAIN_WALLET_ID4!,
  });

  const response5 = await client.getWalletTokenBalance({
    id: CROSSCHAIN_WALLET_ID5!,
  });

  const response6 = await client.getWalletTokenBalance({
    id: CROSSCHAIN_WALLET_ID6!,
  });

  console.log("=== CROSSCHAIN_WALLET_ID1の残高 ===");
  console.log(JSON.stringify(response.data, null, 2));

  console.log("=== CROSSCHAIN_WALLET_ID2の残高 ===");
  console.log(JSON.stringify(response2.data, null, 2));

  console.log("=== CROSSCHAIN_WALLET_ID3の残高 ===");
  console.log(JSON.stringify(response3.data, null, 2));

  console.log("=== CROSSCHAIN_WALLET_ID4の残高 ===");
  console.log(JSON.stringify(response4.data, null, 2));

  console.log("=== CROSSCHAIN_WALLET_ID5の残高 ===");
  console.log(JSON.stringify(response5.data, null, 2));

  console.log("=== CROSSCHAIN_WALLET_ID6の残高 ===");
  console.log(JSON.stringify(response6.data, null, 2));
};

main();