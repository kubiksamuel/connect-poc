import { OpenAI } from "openai";
import { openaiClient } from "./openAIClient";
import { TEMPERATURE } from "./index";

export async function sendRequestToOpenAi(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  model: string = "gpt-4o-mini"
): Promise<string | null> {
  try {
    const response = await openaiClient.chat.completions.create({
      model,
      messages,
      temperature: TEMPERATURE,
      max_tokens: 400,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating openai request:", error);
    // Fallback to a generic message
    return null;
  }
}
