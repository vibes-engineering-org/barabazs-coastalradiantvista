import { erc20Abi } from "viem";

/**
 * Utility for handling sequential transactions efficiently
 * This follows Farcaster Mini App best practices for transaction management
 */

export interface TransactionStep {
  name: string;
  contractAddress: `0x${string}`;
  abi: readonly any[] | any[];
  functionName: string;
  args: any[];
  value?: bigint;
}

/**
 * Create approve and mint transaction steps for ERC20-based NFT minting
 */
export function createApproveAndMintSteps(
  erc20TokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  approvalAmount: bigint,
  mintContractAddress: `0x${string}`,
  mintAbi: readonly any[] | any[],
  mintFunctionName: string,
  mintArgs: any[],
  mintValue: bigint = BigInt(0)
): TransactionStep[] {
  return [
    {
      name: "Approve tokens",
      contractAddress: erc20TokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, approvalAmount],
    },
    {
      name: "Mint NFT",
      contractAddress: mintContractAddress,
      abi: mintAbi,
      functionName: mintFunctionName,
      args: mintArgs,
      value: mintValue,
    },
  ];
}

/**
 * Create token burn transaction steps for multiple tokens
 */
export function createTokenBurnSteps(
  tokenTransfers: Array<{
    tokenAddress: `0x${string}`;
    amount: bigint;
    tokenSymbol?: string;
  }>,
  burnAddress: `0x${string}` = "0x000000000000000000000000000000000000dEaD"
): TransactionStep[] {
  return tokenTransfers.map((transfer, index) => ({
    name: `Burn ${transfer.tokenSymbol || 'token'} ${index + 1}`,
    contractAddress: transfer.tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [burnAddress, transfer.amount],
  }));
}

/**
 * Check if an ERC20 token needs approval for a specific spender
 */
export async function checkTokenApproval(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
  publicClient: any
): Promise<boolean> {
  try {
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    }) as bigint;

    return allowance >= amount;
  } catch (error) {
    console.error("Error checking token approval:", error);
    return false;
  }
}