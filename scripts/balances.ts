import * as fs from "fs";
import * as path from "path";
import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { mainnet } from "viem/chains";

// USDC contract address on Ethereum mainnet
const USDC_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Wallet addresses to check
const WALLET_ADDRESSES = [
  "0x13965336fdc815423b327cd59c78cce253a3072a",
  "0x63c6b4ccfae480e278b64639b69e63ad4a0d0735",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0x8bcf8aff8cb99335cd9f4d9866a40e05e23373ff",
  "0xf95c7338e1d1fff270ae0b483b26c245abcf2016",
  "0xabf648f58dea72afa2d3ca664f8bbc17f644431e",

  "0xf0490b45884803924ca84c2051ef435991d7350d",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0xbae2c7cb51ddadc4112277c3567a7298ea3ac826",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",
  "0x8bcf8aff8cb99335cd9f4d9866a40e05e23373ff",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",

  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0x937c0d4a6294cdfa575de17382c7076b579dc176",
  "0xfe963c6cb36ecf1009bbe357a4c83a97bcdde5a6",
  "0xf0490b45884803924ca84c2051ef435991d7350d",
  "0x2e5cad69010461592a7d03fd07cbafec4c157c97",
  "0xfe963c6cb36ecf1009bbe357a4c83a97bcdde5a6",

  "0xbae2c7cb51ddadc4112277c3567a7298ea3ac826",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",
  "0x937c0d4a6294cdfa575de17382c7076b579dc176",
  "0xee35740d57169773396e0f88a46d4ee1b94ee477",
  "0x224d8f0e0a9a59f7f30fbfea5e46d8ca25e4f33a",
  "0xabf648f58dea72afa2d3ca664f8bbc17f644431e",
  "0x224d8f0e0a9a59f7f30fbfea5e46d8ca25e4f33a",
  "0x88c8a30a000085b42f8e6f0c504e8b8962ac077b",
  "0x96561c772533d32da71d240820a2fbf6883cf96a",
  "0x1109841926f1856fa0ceca263bf3b23151300488",
  "0xf95c7338e1d1fff270ae0b483b26c245abcf2016",
  "0xf0490b45884803924ca84c2051ef435991d7350d",
  "",
  "0x63c6b4ccfae480e278b64639b69e63ad4a0d0735",
  "0xfe963c6cb36ecf1009bbe357a4c83a97bcdde5a6",
  "0x224d8f0e0a9a59f7f30fbfea5e46d8ca25e4f33a",
  "0x13965336fdc815423b327cd59c78cce253a3072a",
  "0xee35740d57169773396e0f88a46d4ee1b94ee477",
  "0x937c0d4a6294cdfa575de17382c7076b579dc176",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",
  "0x88c8a30a000085b42f8e6f0c504e8b8962ac077b",
  "0x1109841926f1856fa0ceca263bf3b23151300488",
  "0xabf648f58dea72afa2d3ca664f8bbc17f644431e",
  "0x224d8f0e0a9a59f7f30fbfea5e46d8ca25e4f33a",
  "0xabf648f58dea72afa2d3ca664f8bbc17f644431e",
  "0x96561c772533d32da71d240820a2fbf6883cf96a",
  "0x63c6b4ccfae480e278b64639b69e63ad4a0d0735",
  "0xee35740d57169773396e0f88a46d4ee1b94ee477",
  "0xf95c7338e1d1fff270ae0b483b26c245abcf2016",
  "0x1109841926f1856fa0ceca263bf3b23151300488",
  "0x1109841926f1856fa0ceca263bf3b23151300488",
  "0xf0490b45884803924ca84c2051ef435991d7350d",
  "0x96561c772533d32da71d240820a2fbf6883cf96a",
  "0x937c0d4a6294cdfa575de17382c7076b579dc176",
  "0x63c6b4ccfae480e278b64639b69e63ad4a0d0735",
  "0x96561c772533d32da71d240820a2fbf6883cf96a",
  "0x4ba092b447407fcfcc70be440ee6f349b65f2735",
  "0x88c8a30a000085b42f8e6f0c504e8b8962ac077b",
  "0x8bcf8aff8cb99335cd9f4d9866a40e05e23373ff",
  "0x13965336fdc815423b327cd59c78cce253a3072a",
  "0x88c8a30a000085b42f8e6f0c504e8b8962ac077b",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0xabf648f58dea72afa2d3ca664f8bbc17f644431e",
  "0x8bcf8aff8cb99335cd9f4d9866a40e05e23373ff",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",

  "0x63c6b4ccfae480e278b64639b69e63ad4a0d0735",
  "0xf0490b45884803924ca84c2051ef435991d7350d",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0xbae2c7cb51ddadc4112277c3567a7298ea3ac826",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",
  "0x8bcf8aff8cb99335cd9f4d9866a40e05e23373ff",
  "0xfe963c6cb36ecf1009bbe357a4c83a97bcdde5a6",
  "0x4ba092b447407fcfcc70be440ee6f349b65f2735",
  "0x44d6a99f0fa0aa32a84085b362ef7ba13ae0047c",
  "0xec83e890d80d343ca878dcf71487c75be292b8d7",
  "0xfe963c6cb36ecf1009bbe357a4c83a97bcdde5a6",
  "0x4ba092b447407fcfcc70be440ee6f349b65f2735",

  "0xf821302722b1160d6113fa5f04f6d79d50f3eb0c",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0xee35740d57169773396e0f88a46d4ee1b94ee477",
  "0x224d8f0e0a9a59f7f30fbfea5e46d8ca25e4f33a",

  "0x13965336fdc815423b327cd59c78cce253a3072a",
  "0x96561c772533d32da71d240820a2fbf6883cf96a",
  "0xf95c7338e1d1fff270ae0b483b26c245abcf2016",

  "0x937c0d4a6294cdfa575de17382c7076b579dc176",
  "0x88c8a30a000085b42f8e6f0c504e8b8962ac077b",
  "0xbae2c7cb51ddadc4112277c3567a7298ea3ac826",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0xf95c7338e1d1fff270ae0b483b26c245abcf2016",

  "0xee35740d57169773396e0f88a46d4ee1b94ee477",
  "0x1109841926f1856fa0ceca263bf3b23151300488",
  "0xbae2c7cb51ddadc4112277c3567a7298ea3ac826",
  "0x4ba092b447407fcfcc70be440ee6f349b65f2735",
  "0x194c31cae1418d5256e8c58e0d08aee1046c6ed0",
  "0x4ba092b447407fcfcc70be440ee6f349b65f2735",
  "0x13965336fdc815423b327cd59c78cce253a3072a",
  "0xa8d13F87c44152008e143C34D411409f898b5f87",
  "0x1852b55b3D59006Db4aAF4f9768b5c38def19156",
  "0xBc70e8A2Ce5bE2f26ba0912336e3F09d2a7D6303",
  "0x374D81A3ae9c93f1C6d5eFF5AaD4aD0De0EB9A60",
  "0x7218eb9C752Fa535AA775149D45CBd37271dbDd9",
  "0xA0d0a1DAB65462B4307703C2A66AFE26eC5c3DfB",
];

// ABI for ERC20 token (only methods we need)
const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

// Create public client
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// Check ETH balance
const getEthBalance = async (address: string): Promise<string> => {
  try {
    const balance = await client.getBalance({
      address: address as `0x${string}`,
    });
    return formatEther(balance);
  } catch (error) {
    console.error(`Error getting ETH balance for ${address}:`, error);
    return "Error";
  }
};

// Check USDC balance
const getUsdcBalance = async (address: string): Promise<string> => {
  try {
    const balance = await client.readContract({
      address: USDC_CONTRACT_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    // USDC always has 6 decimals on Ethereum mainnet
    return formatUnits(balance as bigint, 6);
  } catch (error) {
    console.error(`Error getting USDC balance for ${address}:`, error);
    return "Error";
  }
};

// Main function
const main = async () => {
  const addresses = new Set(WALLET_ADDRESSES);

  console.log(`Found ${addresses.size} unique wallet addresses.`);

  // Define minimum USD threshold
  const MIN_USD_THRESHOLD = 50;

  // Table header
  console.log(
    `Address | ETH Balance | USDC Balance | USD Balance (>= $${MIN_USD_THRESHOLD}) | Wallet Name`,
  );
  console.log(
    "--------|------------|--------------|-------------|------------",
  );

  let usd = 0;
  let filteredCount = 0;

  // Prepare CSV data
  const csvRows = ["Address,ETH Balance,USDC Balance,USD Balance,Wallet Name"];

  // Process each address
  for (const address of addresses) {
    const ethBalance = await getEthBalance(address);
    const usdcBalance = await getUsdcBalance(address);
    const ethUsdValue = Number(ethBalance) * 1600;
    const usdBalance = ethUsdValue + Number(usdcBalance);

    // Only display and count addresses with balance >= MIN_USD_THRESHOLD
    if (usdBalance >= MIN_USD_THRESHOLD) {
      console.log(
        `${address} | ${ethBalance} | ${usdcBalance} | ${usdBalance} | `,
      );
      csvRows.push(`${address},${ethBalance},${usdcBalance},${usdBalance},`);
      usd += usdBalance;
      filteredCount++;
    }
  }

  console.log(
    `\nFound ${filteredCount} addresses with balance >= $${MIN_USD_THRESHOLD}`,
  );
  console.log(`Total USD Balance: ${usd}`);

  // Save to CSV file
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const csvFilePath = path.join("logs", `balances_${timestamp}.csv`);

  // Create logs directory if it doesn't exist
  if (!fs.existsSync("logs")) {
    fs.mkdirSync("logs", { recursive: true });
  }

  // Write CSV data to file
  fs.writeFileSync(csvFilePath, csvRows.join("\n"));
  console.log(`\nResults saved to ${csvFilePath}`);
};

// Run the script
main().catch(console.error);
