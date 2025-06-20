// Token tracking and cost calculation module with accurate streaming support
import { OpenAI } from "openai";

// OpenAI pricing per 1M tokens (as of 2024)
// These prices should be updated based on current OpenAI pricing
export const TOKEN_PRICES = {
  "gpt-4o-mini": {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.6, // $0.60 per 1M output tokens
  },
  "gpt-4o": {
    input: 2.5, // $2.50 per 1M input tokens
    output: 10.0, // $10.00 per 1M output tokens
  },
} as const;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  formattedCost: string;
}

export interface ApiCallLog {
  id: string;
  timestamp: Date;
  model: string;
  purpose: string; // e.g., "warmup_generation", "feedback_classification", "main_chat"
  tokenUsage: TokenUsage;
  cost: CostCalculation;
  requestType: "streaming" | "non-streaming";
  accurate: boolean; // Whether the token count is accurate or estimated
}

class TokenTracker {
  private logs: ApiCallLog[] = [];
  private totalCost = 0;

  /**
   * Calculate cost based on token usage and model
   */
  calculateCost(model: string, tokenUsage: TokenUsage): CostCalculation {
    const pricing = TOKEN_PRICES[model as keyof typeof TOKEN_PRICES];

    if (!pricing) {
      console.warn(
        `⚠️ Unknown model pricing: ${model}. Using gpt-4o-mini pricing as fallback.`
      );
      const fallbackPricing = TOKEN_PRICES["gpt-4o-mini"];
      const inputCost =
        (tokenUsage.promptTokens / 1_000_000) * fallbackPricing.input;
      const outputCost =
        (tokenUsage.completionTokens / 1_000_000) * fallbackPricing.output;
      const totalCost = inputCost + outputCost;

      return {
        inputCost,
        outputCost,
        totalCost,
        formattedCost: `$${totalCost.toFixed(6)}`,
      };
    }

    const inputCost = (tokenUsage.promptTokens / 1_000_000) * pricing.input;
    const outputCost =
      (tokenUsage.completionTokens / 1_000_000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      formattedCost: `$${totalCost.toFixed(6)}`,
    };
  }

  /**
   * Log an API call with token usage
   */
  logApiCall(
    model: string,
    purpose: string,
    tokenUsage: TokenUsage,
    requestType: "streaming" | "non-streaming" = "non-streaming",
    accurate: boolean = true
  ): ApiCallLog {
    const cost = this.calculateCost(model, tokenUsage);
    this.totalCost += cost.totalCost;

    const log: ApiCallLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      model,
      purpose,
      tokenUsage,
      cost,
      requestType,
      accurate,
    };

    this.logs.push(log);

    // Console logging with accuracy indicator
    // const accuracyIndicator = accurate ? "✅" : "⚠️";
    // console.log(
    //   `\n💰 TOKEN USAGE - ${purpose.toUpperCase()} ${accuracyIndicator}`
    // );
    // console.log(`   Model: ${model}`);
    // console.log(`   Input tokens: ${tokenUsage.promptTokens.toLocaleString()}`);
    // console.log(
    //   `   Output tokens: ${tokenUsage.completionTokens.toLocaleString()}`
    // );
    // console.log(`   Total tokens: ${tokenUsage.totalTokens.toLocaleString()}`);
    // console.log(
    //   `   Cost: ${cost.formattedCost} (Input: $${cost.inputCost.toFixed(
    //     6
    //   )}, Output: $${cost.outputCost.toFixed(6)})`
    // );
    // console.log(`   Accuracy: ${accurate ? "Exact" : "Estimated"}`);
    // console.log(`   Total session cost: $${this.totalCost.toFixed(6)}`);

    return log;
  }

  /**
   * Get summary of all token usage and costs
   */
  getSummary() {
    const totalTokens = this.logs.reduce(
      (sum, log) => sum + log.tokenUsage.totalTokens,
      0
    );
    const totalInputTokens = this.logs.reduce(
      (sum, log) => sum + log.tokenUsage.promptTokens,
      0
    );
    const totalOutputTokens = this.logs.reduce(
      (sum, log) => sum + log.tokenUsage.completionTokens,
      0
    );

    const accurateCount = this.logs.filter((log) => log.accurate).length;
    const estimatedCount = this.logs.filter((log) => !log.accurate).length;

    // Group by purpose
    const byPurpose = this.logs.reduce((acc, log) => {
      if (!acc[log.purpose]) {
        acc[log.purpose] = {
          calls: 0,
          tokens: 0,
          cost: 0,
          accurate: 0,
          estimated: 0,
        };
      }
      acc[log.purpose].calls++;
      acc[log.purpose].tokens += log.tokenUsage.totalTokens;
      acc[log.purpose].cost += log.cost.totalCost;
      if (log.accurate) acc[log.purpose].accurate++;
      else acc[log.purpose].estimated++;
      return acc;
    }, {} as Record<string, { calls: number; tokens: number; cost: number; accurate: number; estimated: number }>);

    // Group by model
    const byModel = this.logs.reduce((acc, log) => {
      if (!acc[log.model]) {
        acc[log.model] = {
          calls: 0,
          tokens: 0,
          cost: 0,
          accurate: 0,
          estimated: 0,
        };
      }
      acc[log.model].calls++;
      acc[log.model].tokens += log.tokenUsage.totalTokens;
      acc[log.model].cost += log.cost.totalCost;
      if (log.accurate) acc[log.model].accurate++;
      else acc[log.model].estimated++;
      return acc;
    }, {} as Record<string, { calls: number; tokens: number; cost: number; accurate: number; estimated: number }>);

    return {
      totalCalls: this.logs.length,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCost: this.totalCost,
      formattedTotalCost: `$${this.totalCost.toFixed(6)}`,
      accurateCount,
      estimatedCount,
      byPurpose,
      byModel,
      logs: this.logs,
    };
  }

  /**
   * Print a detailed summary to console
   */
  printSummary() {
    const summary = this.getSummary();

    console.log("\n" + "=".repeat(60));
    console.log("📊 TOKEN USAGE & COST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total API calls: ${summary.totalCalls}`);
    console.log(`  - Accurate: ${summary.accurateCount} ✅`);
    console.log(`  - Estimated: ${summary.estimatedCount} ⚠️`);
    console.log(`Total tokens: ${summary.totalTokens.toLocaleString()}`);
    console.log(
      `  - Input tokens: ${summary.totalInputTokens.toLocaleString()}`
    );
    console.log(
      `  - Output tokens: ${summary.totalOutputTokens.toLocaleString()}`
    );
    console.log(`Total cost: ${summary.formattedTotalCost}`);

    console.log("\n📈 BY PURPOSE:");
    Object.entries(summary.byPurpose).forEach(([purpose, stats]) => {
      console.log(
        `  ${purpose}: ${
          stats.calls
        } calls, ${stats.tokens.toLocaleString()} tokens, $${stats.cost.toFixed(
          6
        )} (${stats.accurate}✅/${stats.estimated}⚠️)`
      );
    });

    console.log("\n🤖 BY MODEL:");
    Object.entries(summary.byModel).forEach(([model, stats]) => {
      console.log(
        `  ${model}: ${
          stats.calls
        } calls, ${stats.tokens.toLocaleString()} tokens, $${stats.cost.toFixed(
          6
        )} (${stats.accurate}✅/${stats.estimated}⚠️)`
      );
    });

    if (summary.estimatedCount > 0) {
      console.log(
        "\n⚠️ NOTE: Some token counts are estimated. Enable stream_options.include_usage for 100% accuracy."
      );
    }

    console.log("=".repeat(60));
  }

  /**
   * Reset all tracking data
   */
  reset() {
    this.logs = [];
    this.totalCost = 0;
    console.log("🔄 Token tracking data reset");
  }

  /**
   * Export logs to JSON
   */
  exportLogs() {
    return {
      summary: this.getSummary(),
      detailedLogs: this.logs,
      exportedAt: new Date().toISOString(),
    };
  }
}

// Global instance
export const tokenTracker = new TokenTracker();

/**
 * Helper function to extract token usage from OpenAI response
 */
export function extractTokenUsage(
  response: OpenAI.Chat.Completions.ChatCompletion
): TokenUsage | null {
  if (!response.usage) {
    console.warn("⚠️ No usage data in OpenAI response");
    return null;
  }

  return {
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens,
  };
}
