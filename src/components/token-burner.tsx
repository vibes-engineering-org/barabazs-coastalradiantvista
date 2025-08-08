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
import { Flame, Wallet, AlertTriangle, CheckCircle, Loader2, RefreshCw, Clock } from "lucide-react";
import { Progress } from "~/components/ui/progress";

interface Token {
  contractAddress: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
  logo?: string;
  isPriority?: boolean;
}

interface LoadingState {
  phase: 'idle' | 'priority' | 'all';
  progress: number;
  total: number;
  message: string;
  retryCount: number;
}

interface TokenCache {
  symbol: string;
  name: string;
  decimals: number;
}

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

const BASE_PRIORITY_TOKENS = [
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', // DEGEN
  '0x4200000000000000000000000000000000000006', // WETH
  '0x1111111111166b7fe7bd91427724b487980afc69', // ZORA
  '0x44ff8620b8ca30902395a7bd3f2407e1a091bf73', // VIRTUALS
  '0x58d97b57bb95320f9a05dc918aef65434969c2b2', // MORPHO
  '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c', // EURC
  '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f', // GHO
  '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // cbETH
  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // DAI
].map(addr => addr.toLowerCase());

const TOKEN_METADATA_CACHE: Record<string, TokenCache> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0x4ed4e862860bed51a9570b96d89af5e1b0efefed': { symbol: 'DEGEN', name: 'Degen', decimals: 18 },
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  '0x1111111111166b7fe7bd91427724b487980afc69': { symbol: 'ZORA', name: 'Zora', decimals: 18 },
  '0x44ff8620b8ca30902395a7bd3f2407e1a091bf73': { symbol: 'VIRTUAL', name: 'Virtuals Protocol', decimals: 18 },
  '0x58d97b57bb95320f9a05dc918aef65434969c2b2': { symbol: 'MORPHO', name: 'Morpho Token', decimals: 18 },
  '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c': { symbol: 'EURC', name: 'Euro Coin', decimals: 6 },
  '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f': { symbol: 'GHO', name: 'GHO Token', decimals: 18 },
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': { symbol: 'cbETH', name: 'Coinbase Wrapped ETH', decimals: 18 },
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, onRetry?: (retryCount: number, maxRetries: number) => void): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      console.debug(`API call attempt ${i + 1}/${retries}:`, options.body);
      const response = await fetch(url, options);
      if (response.ok) {
        console.debug('API call successful');
        return response;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.debug(`API call attempt ${i + 1} failed:`, err);
      if (i === retries - 1) throw err;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.debug(`Retrying in ${delay}ms...`);
      if (onRetry) {
        onRetry(i + 1, retries);
      }
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
};

const fetchTokenMetadata = async (contractAddress: string, alchemyApiKey: string, onRetry?: (retryCount: number, maxRetries: number) => void): Promise<Token | null> => {
  const lowerAddress = contractAddress.toLowerCase();
  
  // Use cached metadata if available
  const cachedMetadata = TOKEN_METADATA_CACHE[lowerAddress];
  if (cachedMetadata) {
    console.debug(`Using cached metadata for ${contractAddress}`);
    return {
      contractAddress,
      name: cachedMetadata.name,
      symbol: cachedMetadata.symbol,
      balance: '0',
      decimals: cachedMetadata.decimals,
      isPriority: BASE_PRIORITY_TOKENS.includes(lowerAddress)
    };
  }

  try {
    const response = await fetchWithRetry(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenMetadata',
        params: [contractAddress]
      })
    }, 3, onRetry);

    const metadataData = await response.json();
    const metadata = metadataData.result;

    if (metadata) {
      return {
        contractAddress,
        name: metadata.name || "Unknown Token",
        symbol: metadata.symbol || "UNKNOWN",
        balance: '0',
        decimals: metadata.decimals || 18,
        logo: metadata.logo,
        isPriority: BASE_PRIORITY_TOKENS.includes(lowerAddress)
      };
    }
  } catch (err) {
    console.error(`Error fetching metadata for ${contractAddress}:`, err);
  }
  return null;
};

export default function TokenBurner() {
  const { address, isConnected, chainId } = useAccount();
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
  const [allTokensLoaded, setAllTokensLoaded] = useState(false);

  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;


  const fetchPriorityTokens = useCallback(async () => {
    if (!address || !alchemyApiKey) {
      if (!alchemyApiKey) {
        console.debug('Alchemy API key is missing');
        setError('Alchemy API key not configured. Please check your environment variables.');
      }
      return;
    }

    console.debug('Starting priority token fetch for address:', address);
    setLoadingState({
      phase: 'priority',
      progress: 0,
      total: BASE_PRIORITY_TOKENS.length,
      message: 'Checking popular tokens...',
      retryCount: 0
    });
    setError(null);

    try {
      const response = await fetchWithRetry(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [address, BASE_PRIORITY_TOKENS]
        })
      }, 3, (retryCount, maxRetries) => {
        setLoadingState(prev => ({ 
          ...prev, 
          retryCount, 
          message: `Retrying... (${retryCount}/${maxRetries})` 
        }));
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
      }

      const tokenBalances = data.result?.tokenBalances || [];
      const tokensWithMetadata: Token[] = [];
      let processed = 0;

      for (const token of tokenBalances) {
        if (parseInt(token.tokenBalance, 16) > 0) {
          const metadata = await fetchTokenMetadata(token.contractAddress, alchemyApiKey, (retryCount, maxRetries) => {
            setLoadingState(prev => ({ 
              ...prev, 
              retryCount, 
              message: `Retrying metadata fetch... (${retryCount}/${maxRetries})` 
            }));
          });
          if (metadata) {
            metadata.balance = token.tokenBalance;
            tokensWithMetadata.push(metadata);
          }
        }
        
        processed++;
        setLoadingState(prev => ({
          ...prev,
          progress: processed,
          message: `Checked ${processed} of ${BASE_PRIORITY_TOKENS.length} popular tokens...`
        }));
      }

      console.debug(`Found ${tokensWithMetadata.length} priority tokens with balance`);
      setTokens(tokensWithMetadata.sort((a, b) => a.symbol.localeCompare(b.symbol)));
      setLoadingState({ phase: 'idle', progress: 0, total: 0, message: '', retryCount: 0 });
    } catch (err) {
      console.error('Priority token fetch failed:', err);
      setError(`Failed to fetch priority tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoadingState({ phase: 'idle', progress: 0, total: 0, message: '', retryCount: 0 });
    }
  }, [address, alchemyApiKey]);

  const fetchAllTokens = useCallback(async () => {
    if (!address || !alchemyApiKey) return;
    
    console.debug('Starting full token scan for address:', address);
    setLoadingState({
      phase: 'all',
      progress: 0,
      total: 100, // Approximate, will be updated
      message: 'Loading all tokens...',
      retryCount: 0
    });
    setError(null);

    try {
      const response = await fetchWithRetry(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20']
        })
      }, 3, (retryCount, maxRetries) => {
        setLoadingState(prev => ({ 
          ...prev, 
          retryCount, 
          message: `Retrying... (${retryCount}/${maxRetries})` 
        }));
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
      }

      const tokenBalances = data.result?.tokenBalances || [];
      const tokensWithBalance = tokenBalances.filter((token: any) => parseInt(token.tokenBalance, 16) > 0);
      
      setLoadingState(prev => ({ ...prev, total: tokensWithBalance.length }));
      
      const tokensWithMetadata: Token[] = [];
      let processed = 0;

      for (const token of tokensWithBalance) {
        const metadata = await fetchTokenMetadata(token.contractAddress, alchemyApiKey, (retryCount, maxRetries) => {
          setLoadingState(prev => ({ 
            ...prev, 
            retryCount, 
            message: `Retrying metadata fetch... (${retryCount}/${maxRetries})` 
          }));
        });
        if (metadata) {
          metadata.balance = token.tokenBalance;
          tokensWithMetadata.push(metadata);
        }
        
        processed++;
        setLoadingState(prev => ({
          ...prev,
          progress: processed,
          message: `Loading ${processed} of ${tokensWithBalance.length} tokens...`
        }));
      }

      console.debug(`Found ${tokensWithMetadata.length} total tokens with balance`);
      
      // Sort with priority tokens first, then alphabetically
      const sortedTokens = tokensWithMetadata.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
      
      setTokens(sortedTokens);
      setAllTokensLoaded(true);
      setLoadingState({ phase: 'idle', progress: 0, total: 0, message: '', retryCount: 0 });
    } catch (err) {
      console.error('Full token fetch failed:', err);
      setError(`Failed to fetch all tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoadingState({ phase: 'idle', progress: 0, total: 0, message: '', retryCount: 0 });
    }
  }, [address, alchemyApiKey]);

  useEffect(() => {
    if (isConnected && address) {
      fetchPriorityTokens();
    }
  }, [isConnected, address, alchemyApiKey, fetchPriorityTokens]);

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
                    {loadingState.phase === 'priority' ? 'Loading popular tokens first' : 'Fetching all ERC20 token balances'}
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPriorityTokens}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retry Priority
                  </Button>
                  {!alchemyApiKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open('https://docs.alchemy.com/docs/alchemy-quickstart-guide', '_blank')}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      Get API Key
                    </Button>
                  )}
                </div>
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
                onClick={fetchAllTokens}
                className="mt-4"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Scan All Tokens
              </Button>
            </div>
          )}

          {loadingState.phase === 'idle' && tokens.length > 0 && (
            <>
              {!allTokensLoaded && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Popular tokens loaded</p>
                    <p className="text-blue-600">Want to see all your tokens?</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAllTokens}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    Load All Tokens
                  </Button>
                </div>
              )}
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {tokens.map((token, index) => (
                  <label
                    key={token.contractAddress} 
                    className={`group flex items-center gap-4 p-4 border-2 rounded-xl hover:shadow-md transition-all duration-200 animate-fade-in cursor-pointer select-none ${
                      token.isPriority 
                        ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-white hover:border-blue-300'
                        : 'border-gray-200 bg-gradient-to-r from-white to-red-50/30 hover:border-red-300'
                    }`}
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
                            {token.isPriority && (
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {token.symbol}
                          </Badge>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          <p className="font-bold text-lg">
                            {parseFloat(formatTokenBalance(token.balance, token.decimals)).toLocaleString()}
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