import { OpenAI } from "openai";
import { openaiClient } from "./openAIClient";
import { TEMPERATURE } from "./index";
import { tokenTracker, extractTokenUsage } from "./tokenTracker";

export async function sendRequestToOpenAi(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  model: string = "gpt-4o-mini",
  purpose: string = "general_request"
): Promise<string | null> {
  try {
    const response = await openaiClient.chat.completions.create({
      model,
      messages,
      temperature: TEMPERATURE,
      max_tokens: 400,
    });

    // Track token usage
    const tokenUsage = extractTokenUsage(response);
    if (tokenUsage) {
      tokenTracker.logApiCall(model, purpose, tokenUsage, "non-streaming");
    }

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating openai request:", error);
    // Fallback to a generic message
    return null;
  }
}
