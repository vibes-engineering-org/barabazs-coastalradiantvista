import { NextRequest, NextResponse } from "next/server";
import { Token } from "~/lib/types";

interface ZapperToken {
  symbol: string;
  tokenAddress: string;
  balance: string;
  balanceRaw: string;
  price: number;
  name: string;
  decimals: number;
}

interface AlchemyPortfolioToken {
  address: string;
  network: string;
  tokenAddress: string;
  tokenBalance: string;
  tokenMetadata: {
    decimals: number;
    logo: string;
    name: string;
    symbol: string;
  };
  tokenPrices?: {
    network: string;
    address: string;
    prices: Array<{
      currency: string;
      value: string;
      lastUpdatedAt: string;
    }>;
    error?: string;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await sleep(delay);
    }
  }
  throw new Error("Max retries exceeded");
};

const fetchAlchemyPortfolioTokens = async (
  address: string,
  alchemyApiKey: string
): Promise<Token[]> => {
  console.log(
    "Fetching tokens from Alchemy Portfolio API for address:",
    address
  );

  let allTokens: AlchemyPortfolioToken[] = [];
  let pageKey: string | undefined;
  let pageCount = 0;
  const maxPages = 10; // Safety limit to prevent infinite loops

  do {
    const requestBody = {
      addresses: [{ address: address, networks: ["base-mainnet"] }],
      includeMetadata: true,
      includePrices: false,
      ...(pageKey && { pageKey }),
    };

    const response = await fetchWithRetry(
      `https://api.g.alchemy.com/data/v1/${alchemyApiKey}/assets/tokens/by-address`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(`Alchemy Portfolio API Error: ${data.error.message}`);
    }

    console.log(
      `Alchemy Portfolio API page ${pageCount + 1} response:`,
      JSON.stringify(
        {
          tokensCount: data.data?.tokens?.length || 0,
          pageKey: data.data?.pageKey,
        },
        null,
        2
      )
    );

    const tokens = data.data?.tokens || [];
    allTokens.push(...tokens);

    pageKey = data.data?.pageKey;
    pageCount++;

    // Safety check to prevent infinite loops
    if (pageCount >= maxPages) {
      console.warn(
        `Reached maximum page limit (${maxPages}) for Alchemy Portfolio API`
      );
      break;
    }
  } while (pageKey);

  console.log(
    `Fetched ${allTokens.length} total tokens across ${pageCount} pages`
  );

  // Process tokens with metadata
  const processedTokens = allTokens
    .filter((token: AlchemyPortfolioToken) => {
      // Only include tokens with balance > 0, valid tokenAddress and decimals
      const balance = parseInt(token.tokenBalance, 16);
      return (
        balance > 0 &&
        token.tokenAddress &&
        token.tokenMetadata?.decimals !== null
      );
    })
    .map((token: AlchemyPortfolioToken) => {
      const balance = parseInt(token.tokenBalance, 16);
      const decimals = token.tokenMetadata?.decimals ?? 18;
      const balanceFormatted = (balance / Math.pow(10, decimals)).toString();

      return {
        contractAddress: token.tokenAddress,
        symbol: token.tokenMetadata?.symbol || "UNKNOWN",
        name: token.tokenMetadata?.name || "Unknown Token",
        balance: token.tokenBalance,
        balanceFormatted: balanceFormatted,
      } as Token;
    });

  return processedTokens;
};

const fetchZapperTokens = async (
  address: string,
  zapperApiKey: string
): Promise<Token[]> => {
  console.log("Fetching tokens from Zapper for address:", address);

  const query = `
    query GetPortfolio($addresses: [Address!]!, $chainIds: [Int!]) {
      portfolioV2(addresses: $addresses, chainIds: $chainIds) {
        tokenBalances {
          byToken {
            edges {
              node {
                balance
                balanceRaw
                symbol
                name
                tokenAddress
                decimals
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetchWithRetry("https://public.zapper.xyz/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-zapper-api-key": zapperApiKey,
    },
    body: JSON.stringify({
      query,
      variables: {
        addresses: [address],
        chainIds: [8453], // Base network chain ID
      },
    }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(
      `Zapper API Error: ${data.errors[0]?.message || "Unknown error"}`
    );
  }

  console.log("Zapper API response:", JSON.stringify(data, null, 2));

  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    throw new Error("GraphQL query failed");
  }

  const portfolio = data.data?.portfolioV2;
  if (!portfolio) {
    throw new Error("No portfolio data returned from Zapper");
  }

  const tokenBalances = portfolio.tokenBalances;
  if (!tokenBalances?.byToken?.edges) {
    return [];
  }

  // Process tokens
  const processedTokens = tokenBalances.byToken.edges
    .map((edge: any) => {
      const token: ZapperToken = edge.node;
      // Only include tokens with balance > 0

      if (Number(token.balance) > 0 || Number(token.balanceRaw) > 0) {
        return {
          contractAddress: token.tokenAddress,
          symbol: token.symbol || "UNKNOWN",
          name: token.name || "Unknown Token",
          balance: token.balanceRaw,
          balanceFormatted: token.balance,
        } as Token;
      }
      return null;
    })
    .filter(Boolean);

  return processedTokens as Token[];
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const zapperApiKey = process.env.ZAPPER_API_KEY;
  const alchemyApiKey =
    process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  try {
    let allTokens: Token[] = [];

    // Step 1: Try Zapper API first (if API key is available)
    if (zapperApiKey) {
      try {
        const zapperTokens = await fetchZapperTokens(address, zapperApiKey);
        allTokens = zapperTokens;

        if (allTokens.length > 0) {
          return NextResponse.json({
            tokens: allTokens.sort((a, b) => a.symbol.localeCompare(b.symbol)),
            source: "zapper",
          });
        }
      } catch (zapperError) {
        console.warn("Zapper API failed:", zapperError);
      }
    }

    // Step 2: Fallback to Alchemy Portfolio API (if API key is available)
    if (alchemyApiKey) {
      try {
        const alchemyTokens = await fetchAlchemyPortfolioTokens(
          address,
          alchemyApiKey
        );
        allTokens = alchemyTokens;

        if (allTokens.length > 0) {
          return NextResponse.json({
            tokens: allTokens.sort((a, b) => a.symbol.localeCompare(b.symbol)),
            source: "alchemy-portfolio",
          });
        }
      } catch (alchemyError) {
        console.warn(
          "Alchemy Portfolio API failed, falling back to Zapper:",
          alchemyError
        );
      }
    }

    // Step 3: If no API keys available, return error
    if (!zapperApiKey && !alchemyApiKey) {
      return NextResponse.json(
        {
          error:
            "No API keys configured. Please set ZAPPER_API_KEY or ALCHEMY_API_KEY",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tokens: allTokens.sort((a, b) => a.symbol.localeCompare(b.symbol)),
      source: "none",
    });
  } catch (error) {
    console.error("Token fetching failed:", error);
    return NextResponse.json(
      {
        error: `Failed to fetch tokens: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
