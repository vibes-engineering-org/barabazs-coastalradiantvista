"use client";

import { PROJECT_TITLE } from "~/lib/constants";
import TokenBurner from "~/components/token-burner";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50/30">
      <div className="w-full max-w-4xl mx-auto py-8 px-4 min-h-screen">
        {/* TEMPLATE_CONTENT_START - Replace content below */}
        <div className="space-y-12">
          <div className="text-center space-y-4 animate-fade-in">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-red-100 rounded-full border border-red-200">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-800 text-sm font-medium">Token Burning Interface</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-red-800 bg-clip-text text-transparent">
              Token Burner
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Permanently and irreversibly burn your ERC20 tokens from the Base network. 
              This action cannot be undone.
            </p>
          </div>
          <div className="animate-slide-up">
            <TokenBurner />
          </div>
        </div>
        {/* TEMPLATE_CONTENT_END */}
      </div>
    </div>
  );
}
