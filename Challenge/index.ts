import { config as dotenv } from "dotenv";
import {
  createWalletClient,
  http,
  createPublicClient,
  parseUnits,
  maxUint256,
  publicActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scrollSepolia } from "viem/chains";
import { wethAbi } from "./abi/weth-abi.js"; 
import { erc20Abi } from "./abi/erc20-abi.js";

// Load environment variables
dotenv();
const { ZERO_EX_API_KEY, UNIFRA_HTTP_TRANSPORT_URL, PRIVATE_KEY } = process.env;

// Validate environment variables
if (!PRIVATE_KEY) throw new Error("missing PRIVATE_KEY.");
if (!UNIFRA_HTTP_TRANSPORT_URL) throw new Error("missing UNIFRA_HTTP_TRANSPORT_URL.");

// Configure API headers
const headers = new Headers({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${process.env.ZERO_EX_API_KEY}`,  // Use Unifra API key
});

// Configure public client for blockchain reads
const publicClient = createPublicClient({
  chain: scrollSepolia,
  transport: http(UNIFRA_HTTP_TRANSPORT_URL),
});

// Configure wallet client for writes and signatures
const walletClient = createWalletClient({
  account: privateKeyToAccount(`0x${PRIVATE_KEY}` as `0x${string}`),
  chain: scrollSepolia,
  transport: http(UNIFRA_HTTP_TRANSPORT_URL),
}).extend(publicActions);

// Example of reading a block with the public client
async function getBlockData() {
  try {
    const block = await publicClient.getBlock({
      blockNumber: 123456n,
    });
    console.log(block);
  } catch (error) {
    console.error("Error retrieving block:", error);
  }
}

getBlockData();

// Configure contracts (WETH and wstETH)
const weth = {
  address: "0x5300000000000000000000000000000000000004" as `0x${string}`,
  abi: wethAbi,
};

const wsteth = {
  address: "0x2DAf22Caf40404ad8ff0Ab1E77F9C08Fef3953e2" as `0x${string}`,
  abi: erc20Abi,
};

// Main function for writes (approve, sign, etc.)
const main = async () => {
  const sellAmount = parseUnits("0.1", 18);

  // 1. Retrieve the exchange price
  const priceParams = new URLSearchParams({
    chainId: walletClient.chain.id.toString(),
    sellToken: weth.address,
    buyToken: wsteth.address,
    sellAmount: sellAmount.toString(),
    taker: walletClient.account.address,
  });

  const priceResponse = await fetch(`${UNIFRA_HTTP_TRANSPORT_URL}/swap/permit2/price?${priceParams}`, {
    headers,
  });

  const price = await priceResponse.json();
  console.log("Retrieving the price to exchange 0.1 WETH for wstETH");
  console.log("priceResponse: ", price);

  // 2. Check if the taker needs to approve Permit2 to spend WETH
  if (price.issues && price.issues.allowance !== null) {
    try {
      const approvalTx = await walletClient.writeContract({
        address: weth.address,
        abi: wethAbi,
        functionName: "approve",
        args: [price.issues.allowance.spender, maxUint256],
        account: walletClient.account,
        chain: scrollSepolia, // Use Scroll Sepolia here for the transaction
      });
      console.log("Approval of Permit2 to spend WETH...", approvalTx);

      // Wait for the transaction confirmation
      const receipt = await walletClient.waitForTransactionReceipt({ hash: approvalTx });
      console.log("Permit2 approved to spend WETH. Transaction received:", receipt);
    } catch (error) {
      console.error("Error approving Permit2:", error);
    }
  } else {
    console.log("WETH already approved for Permit2");
  }

  // Function to get asset transfers
  async function getAssetTransfers(address) {
    const response = await fetch(`${UNIFRA_HTTP_TRANSPORT_URL}/unifra_getAssetTransfers`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ZERO_EX_API_KEY}`,
      },
      body: JSON.stringify({
        params: [address], // Replace with the address you want to query
        jsonrpc: "2.0",
        id: 1
      }),
    });

    const data = await response.json();
    console.log("Transfers:", data);
  }

  // Function to get token metadata
  async function getTokenMetadata(tokenAddress) {
    const response = await fetch(`${UNIFRA_HTTP_TRANSPORT_URL}/unifra_getTokenMetadata`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ZERO_EX_API_KEY}`,
      },
      body: JSON.stringify({
        params: [tokenAddress], // Replace with the token address
        jsonrpc: "2.0",
        id: 1
      }),
    });

    const data = await response.json();
    console.log("Token metadata:", data);
  }

  // Function to get token balances
  async function getTokenBalances(address, tokenAddresses) {
    const response = await fetch(`${UNIFRA_HTTP_TRANSPORT_URL}/unifra_getTokenBalances`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ZERO_EX_API_KEY}`,
      },
      body: JSON.stringify({
        params: [address, tokenAddresses], // Replace with the address and list of tokens
        jsonrpc: "2.0",
        id: 1
      }),
    });

    const data = await response.json();
    console.log("Token balances:", data);
  }

  // Function to get token allowance
  async function getTokenAllowance(owner, spender, tokenAddress) {
    const response = await fetch(`${UNIFRA_HTTP_TRANSPORT_URL}/unifra_getTokenAllowance`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ZERO_EX_API_KEY}`,
      },
      body: JSON.stringify({
        params: [owner, spender, tokenAddress], // Replace with the owner's address, spender, and token address
        jsonrpc: "2.0",
        id: 1
      }),
    });

    const data = await response.json();
    console.log("Token allowance:", data);
  }
};

// Execute the main function
main();
