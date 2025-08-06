"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import { base } from "wagmi/chains";
import { Flame, Wallet, AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";

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

  const fetchTokens = useCallback(async () => {
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
  }, [address, alchemyApiKey]);

  useEffect(() => {
    if (isConnected && address) {
      fetchTokens();
    }
  }, [isConnected, address, alchemyApiKey, fetchTokens]);

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
      // Use batched transactions instead of multicall as per Farcaster docs
      // Send each token burn as a separate transaction in sequence
      for (let i = 0; i < selectedTokensList.length; i++) {
        const token = selectedTokensList[i];
        const balance = BigInt(token.balance);
        
        await writeContract({
          address: token.contractAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [BURN_ADDRESS, balance],
          chainId: base.id
        });

        // Wait a moment before sending next transaction to avoid nonce conflicts
        if (i < selectedTokensList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
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
      <Card className="w-full max-w-2xl mx-auto border-2 border-dashed border-muted-foreground/20">
        <CardContent className="p-12 text-center space-y-4">
          <div className="flex justify-center">
            <Wallet className="h-16 w-16 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Connect Wallet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect your wallet to view your ERC20 tokens and burn them permanently
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chainId !== base.id) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-2 border-orange-200 bg-orange-50/50">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-orange-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-orange-800">Wrong Network</h3>
            <p className="text-orange-600 max-w-md mx-auto">
              Please switch to Base network to use this token burning app
            </p>
          </div>
          <Badge variant="outline" className="text-orange-700 border-orange-300">
            Base Network Required
          </Badge>
        </CardContent>
      </Card>
    );
  }

  if (showConfirmation) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-2 border-red-200 bg-red-50/30 animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <Flame className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-800">Confirm Token Burn</CardTitle>
          <p className="text-red-600 max-w-md mx-auto">
            You are about to permanently destroy the following tokens. This action cannot be undone.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {selectedTokensList.map((token, index) => (
              <div 
                key={token.contractAddress} 
                className="flex justify-between items-center p-4 bg-white border border-red-100 rounded-xl shadow-sm animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">{token.name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {token.symbol}
                  </Badge>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-lg text-red-600">
                    {parseFloat(formatTokenBalance(token.balance, token.decimals)).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">to be burned</p>
                </div>
              </div>
            ))}
          </div>

          <Separator className="bg-red-200" />

          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmation(false)}
              disabled={isPending || isConfirming}
              className="flex-1 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBurnTokens}
              disabled={isPending || isConfirming}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Flame className="mr-2 h-4 w-4" />
                  Burn {selectedTokensList.length} Token{selectedTokensList.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>

          {writeError && (
            <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">
                {writeError.message}
              </p>
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-green-700">
                Tokens burned successfully! Transaction: {hash?.slice(0, 10)}...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <Card className="border-2 border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="relative">
              <Flame className="h-10 w-10 text-red-500" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Your ERC20 Tokens</CardTitle>
            <p className="text-muted-foreground">Select tokens to burn permanently</p>
          </div>
          {tokens.length > 0 && (
            <Badge variant="outline" className="mx-auto">
              {tokens.length} token{tokens.length > 1 ? 's' : ''} found
            </Badge>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {loading && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
              <div>
                <p className="font-medium">Loading tokens...</p>
                <p className="text-sm text-muted-foreground">Fetching your ERC20 token balances</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="text-red-700 text-sm font-medium">Error loading tokens</p>
                <p className="text-red-600 text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTokens}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && tokens.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <Wallet className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <div>
                <p className="font-medium text-lg">No tokens found</p>
                <p className="text-muted-foreground">No ERC20 tokens were found in your wallet</p>
              </div>
            </div>
          )}

          {!loading && tokens.length > 0 && (
            <>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {tokens.map((token, index) => (
                  <div 
                    key={token.contractAddress} 
                    className="group flex items-center space-x-4 p-4 border-2 border-transparent hover:border-red-200 rounded-xl bg-gradient-to-r from-white to-red-50/30 hover:shadow-md transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Checkbox
                      checked={selectedTokens.has(token.contractAddress)}
                      onCheckedChange={(checked) => 
                        handleTokenSelect(token.contractAddress, checked as boolean)
                      }
                      className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900 group-hover:text-red-800 transition-colors">
                            {token.name}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {token.symbol}
                          </Badge>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="font-bold text-lg">
                            {parseFloat(formatTokenBalance(token.balance, token.decimals)).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">available</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTokens(new Set())}
                  disabled={selectedTokens.size === 0}
                  className="flex-1 border-gray-300"
                >
                  Clear Selection
                </Button>
                <Button 
                  onClick={() => setShowConfirmation(true)}
                  disabled={selectedTokens.size === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg"
                >
                  <Flame className="mr-2 h-4 w-4" />
                  Burn Selected ({selectedTokens.size})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}