"use client";

import { PROJECT_TITLE } from "~/lib/constants";
import TokenBurner from "~/components/token-burner";

export default function App() {
  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 min-h-screen">
      {/* TEMPLATE_CONTENT_START - Replace content below */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Token Burner
          </h1>
          <p className="text-muted-foreground">
            Permanently burn your ERC20 tokens
          </p>
        </div>
        <TokenBurner />
      </div>
      {/* TEMPLATE_CONTENT_END */}
    </div>
  );
}
