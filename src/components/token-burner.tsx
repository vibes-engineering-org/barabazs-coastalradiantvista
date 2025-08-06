"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { formatUnits, parseUnits, encodeFunctionData, erc20Abi } from "viem";
import { base } from "wagmi/chains";

interface Token {
  contractAddress: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
  logo?: string;
}

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export default function TokenBurner() {
  const { address, isConnected, chainId } = useAccount();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  const fetchTokens = async () => {
    if (!address || !alchemyApiKey) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20']
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setError(`API Error: ${data.error.message}`);
        return;
      }

      const tokenBalances = data.result?.tokenBalances || [];
      const tokensWithMetadata: Token[] = [];

      for (const token of tokenBalances) {
        if (parseInt(token.tokenBalance, 16) > 0) {
          try {
            const metadataResponse = await fetch(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'alchemy_getTokenMetadata',
                params: [token.contractAddress]
              })
            });

            const metadataData = await metadataResponse.json();
            const metadata = metadataData.result;

            if (metadata) {
              tokensWithMetadata.push({
                contractAddress: token.contractAddress,
                name: metadata.name || "Unknown Token",
                symbol: metadata.symbol || "UNKNOWN",
                balance: token.tokenBalance,
                decimals: metadata.decimals || 18,
                logo: metadata.logo
              });
            }
          } catch (err) {
            console.error(`Error fetching metadata for ${token.contractAddress}:`, err);
          }
        }
      }

      setTokens(tokensWithMetadata);
    } catch (err) {
      setError(`Failed to fetch tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchTokens();
    }
  }, [isConnected, address, alchemyApiKey]);

  const selectedTokensList = useMemo(() => {
    return tokens.filter(token => selectedTokens.has(token.contractAddress));
  }, [tokens, selectedTokens]);

  const handleTokenSelect = (contractAddress: string, checked: boolean) => {
    const newSelected = new Set(selectedTokens);
    if (checked) {
      newSelected.add(contractAddress);
    } else {
      newSelected.delete(contractAddress);
    }
    setSelectedTokens(newSelected);
  };

  const handleBurnTokens = async () => {
    if (!publicClient || selectedTokensList.length === 0) return;

    try {
      const calls = selectedTokensList.map(token => {
        const balance = BigInt(token.balance);
        return {
          to: token.contractAddress as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [BURN_ADDRESS, balance]
          }),
          value: 0n
        };
      });

      await writeContract({
        address: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3 contract
        abi: [
          {
            inputs: [
              {
                components: [
                  { name: 'target', type: 'address' },
                  { name: 'callData', type: 'bytes' }
                ],
                name: 'calls',
                type: 'tuple[]'
              }
            ],
            name: 'aggregate',
            outputs: [
              { name: 'blockNumber', type: 'uint256' },
              { name: 'returnData', type: 'bytes[]' }
            ],
            stateMutability: 'payable',
            type: 'function'
          }
        ],
        functionName: 'aggregate',
        args: [calls.map(call => ({ target: call.to, callData: call.data }))],
        chainId: base.id
      });
    } catch (err) {
      setError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const formatTokenBalance = (balance: string, decimals: number) => {
    const balanceBigInt = BigInt(balance);
    return formatUnits(balanceBigInt, decimals);
  };

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Connect your wallet to view and burn tokens</p>
        </CardContent>
      </Card>
    );
  }

  if (chainId !== base.id) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please switch to Base network to use this app</p>
        </CardContent>
      </Card>
    );
  }

  if (showConfirmation) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Confirm Token Burn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You are about to burn the following tokens. This action cannot be undone.
          </p>
          
          <div className="space-y-3">
            {selectedTokensList.map((token) => (
              <div key={token.contractAddress} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{token.name}</p>
                  <p className="text-sm text-muted-foreground">{token.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatTokenBalance(token.balance, token.decimals)}</p>
                  <p className="text-xs text-muted-foreground">tokens</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmation(false)}
              disabled={isPending || isConfirming}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBurnTokens}
              disabled={isPending || isConfirming}
              className="flex-1"
            >
              {isPending || isConfirming ? "Processing..." : "Burn Tokens"}
            </Button>
          </div>

          {writeError && (
            <p className="text-sm text-destructive mt-2">
              Error: {writeError.message}
            </p>
          )}

          {isSuccess && (
            <p className="text-sm text-green-600 mt-2">
              Tokens burned successfully! Transaction hash: {hash}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Token Burner</CardTitle>
        <p className="text-muted-foreground">Select tokens to burn permanently</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading tokens...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTokens}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && tokens.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No ERC20 tokens found in your wallet</p>
          </div>
        )}

        {!loading && tokens.length > 0 && (
          <>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tokens.map((token) => (
                <div key={token.contractAddress} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    checked={selectedTokens.has(token.contractAddress)}
                    onCheckedChange={(checked) => 
                      handleTokenSelect(token.contractAddress, checked as boolean)
                    }
                  />
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{token.name}</p>
                        <p className="text-sm text-muted-foreground">{token.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatTokenBalance(token.balance, token.decimals)}</p>
                        <p className="text-xs text-muted-foreground">balance</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setSelectedTokens(new Set())}
                disabled={selectedTokens.size === 0}
                className="flex-1"
              >
                Clear Selection
              </Button>
              <Button 
                onClick={() => setShowConfirmation(true)}
                disabled={selectedTokens.size === 0}
                className="flex-1"
              >
                Burn Selected ({selectedTokens.size})
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}