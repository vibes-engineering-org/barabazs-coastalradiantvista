"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useSendCalls, useWaitForCallsStatus, usePublicClient, useConnect } from "wagmi";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { formatUnits, erc20Abi, encodeFunctionData } from "viem";
import { base } from "wagmi/chains";
import { farcasterFrame } from "@farcaster/miniapp-wagmi-connector";
import { Flame, Wallet, AlertTriangle, CheckCircle, Loader2, RefreshCw, Clock } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { useMiniAppSdk } from "~/hooks/use-miniapp-sdk";
import { Token } from "~/lib/types";

interface LoadingState {
  phase: 'idle' | 'all';
  progress: number;
  total: number;
  message: string;
  retryCount: number;
}


const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";


export default function TokenBurner() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [loadingState, setLoadingState] = useState<LoadingState>({
    phase: 'idle',
    progress: 0,
    total: 0,
    message: '',
    retryCount: 0
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { isSDKLoaded } = useMiniAppSdk();
  useEffect(() => {
    if (!isSDKLoaded) {
      console.warn("Mini App SDK is not loaded yet. Please wait.");
    } else {
      console.debug("Mini App SDK is loaded, ready to use.");
    }
  }, [isSDKLoaded]);

  const { sendCalls, data: callsId, isPending, error: sendCallsError } = useSendCalls();
  const {
    data: callsStatus,
    isLoading: isConfirming,
    isSuccess: isCallsSuccess,
    error: callsStatusError
  } = useWaitForCallsStatus({
    id: callsId?.id,
    query: {
      enabled: !!callsId?.id,
    },
  });

  // Reset selected tokens when burn is successful
  useEffect(() => {
    if (isCallsSuccess && (callsStatus as any)?.status === 'success') {
      setSelectedTokens(new Set());
    }
  }, [isCallsSuccess, callsStatus]);


  const fetchAllTokens = useCallback(async () => {
    if (!address) return;

    console.debug('Starting full token scan for address:', address);
    setLoadingState({
      phase: 'all',
      progress: 0,
      total: 100,
      message: 'Loading all tokens...',
      retryCount: 0
    });
    setError(null);

    try {
      const response = await fetch(`/api/tokens/${address}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const { tokens: allTokens, source } = data;

      // console.debug(`API returned ${allTokens.length} tokens (source: ${source})`);

      setTokens(allTokens);

      setLoadingState({ phase: 'idle', progress: 0, total: 0, message: '', retryCount: 0 });

    } catch (err) {
      console.error('Token fetch failed:', err);
      setError(`Failed to fetch tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoadingState({ phase: 'idle', progress: 0, total: 0, message: '', retryCount: 0 });
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      void fetchAllTokens();
    }
  }, [isConnected, address, fetchAllTokens]);

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
      setError(null);

      // Create batched transaction calls for all selected tokens
      console.log(`Starting batched burn of ${selectedTokensList.length} tokens`);

      const calls = selectedTokensList.map(token => {
        const balance = BigInt(token.balance);
        return {
          to: token.contractAddress as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [BURN_ADDRESS, balance],
          }),
        };
      });

      await sendCalls({
        calls,
        chainId: base.id,
      });

    } catch (err) {
      console.error('Batched token burn failed:', err);
      setError(`Batched token burn failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  // Handle manual wallet connection
  const handleConnect = () => {
    try {
      const connector = farcasterFrame();
      connect({ connector });
    } catch (err) {
      setError(`Failed to connect wallet: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
          <Button onClick={handleConnect} size="lg" className="mt-6">
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
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
                    {token.balanceFormatted}
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

          {(sendCallsError || callsStatusError) && (
            <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">
                {sendCallsError?.message || callsStatusError?.message}
              </p>
            </div>
          )}

          {isConfirming && callsId && (
            <div className="flex items-center gap-2 p-3 bg-blue-100 border border-blue-200 rounded-lg">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <p className="text-sm text-blue-700">
                Waiting for burn transaction to complete... Status: {(callsStatus as any)?.status || 'pending'}
              </p>
            </div>
          )}

          {(callsStatus as any)?.status === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-200 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm text-green-700">
                  Tokens burned successfully! They have been sent to the burn address.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedTokens(new Set());
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedTokens(new Set());
                    void fetchAllTokens();
                  }}
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Tokens
                </Button>
              </div>
            </div>
          )}

          {(callsStatus as any)?.status === 'failure' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700">
                  Token burn failed. The transaction was not successful.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1"
                >
                  Go Back
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedTokens(new Set());
                    void fetchAllTokens();
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  onClick={handleBurnTokens}
                  disabled={isPending || isConfirming}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Try Again
                </Button>
              </div>
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
          {loadingState.phase !== 'all' && tokens.length > 0 && (
            <Badge variant="outline" className="mx-auto">
              {tokens.length} token{tokens.length > 1 ? 's' : ''} found
            </Badge>
          )}
          {loadingState.phase === 'all' && loadingState.total > 0 && (
            <Badge variant="outline" className="mx-auto">
              {loadingState.total} total ERC20 tokens on Base in your wallet
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {loadingState.phase !== 'idle' && (
            <div className="space-y-4">
              <Progress
                value={(loadingState.progress / Math.max(loadingState.total, 1)) * 100}
                className="w-full h-2"
              />
              <div className="text-center py-8 space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  {loadingState.retryCount > 0 && (
                    <Clock className="h-6 w-6 text-orange-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{loadingState.message}</p>
                  <p className="text-sm text-muted-foreground">
                    Fetching all ERC20 token balances
                  </p>
                  {loadingState.retryCount > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      Retry attempt {loadingState.retryCount}/3
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="text-red-700 text-sm font-medium">Error loading tokens</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {loadingState.phase === 'idle' && !error && tokens.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <Wallet className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <div>
                <p className="font-medium text-lg">No tokens found</p>
                <p className="text-muted-foreground">No ERC20 tokens were found in your wallet</p>
              </div>
              <Button
                variant="outline"
                onClick={() => void fetchAllTokens()}
                className="mt-4"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Scan All Tokens
              </Button>
            </div>
          )}

          {loadingState.phase === 'idle' && tokens.length > 0 && (
            <>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {tokens.map((token, index) => (
                  <label
                    key={token.contractAddress}
                    className="group flex items-center gap-4 p-4 border-2 rounded-xl hover:shadow-md transition-all duration-200 animate-fade-in cursor-pointer select-none border-gray-200 bg-gradient-to-r from-white to-red-50/30 hover:border-red-300"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedTokens.has(token.contractAddress)}
                        onCheckedChange={(checked) =>
                          handleTokenSelect(token.contractAddress, checked as boolean)
                        }
                        className="h-6 w-6 border-2 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 data-[state=unchecked]:border-gray-400 data-[state=unchecked]:bg-gray-50"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 group-hover:text-red-800 transition-colors truncate">
                              {token.name}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {token.symbol}
                          </Badge>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          <p className="font-bold text-lg">
                            {token.balanceFormatted}
                          </p>
                          <p className="text-xs text-muted-foreground">available</p>
                        </div>
                      </div>
                    </div>
                  </label>
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