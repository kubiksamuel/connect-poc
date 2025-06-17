import { OpenAI } from "openai";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { getWeather, functionSpecs } from "./functions";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

async function handleStream(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
) {
  const chunks: string[] = [];
  process.stdout.write("AI: ");

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      process.stdout.write(content);
      chunks.push(content);
    }
  }
  process.stdout.write("\n");
  return chunks.join("");
}

interface ToolCallResult {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  response: string | null;
}

async function handleToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): Promise<ToolCallResult> {
  const result: ToolCallResult = {
    messages: [],
    response: null,
  };

  switch (toolCall.function.name) {
    case "getWeather": {
      const args = JSON.parse(toolCall.function.arguments);
      const functionResponse = getWeather(args);

      result.messages.push({
        role: "assistant",
        tool_calls: [toolCall],
      });

      result.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: functionResponse,
      });

      const followUpStream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [...messages, ...result.messages],
        stream: true,
      });

      const followUpContent = await handleStream(followUpStream);
      result.messages.push({ role: "assistant", content: followUpContent });
      result.response = followUpContent;
      break;
    }
    // Add more function cases here as needed
    default: {
      console.log(`Unknown function: ${toolCall.function.name}`);
    }
  }

  return result;
}

async function processStreamResponse(
  response: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
) {
  let accumulatedContent = "";
  let toolCall:
    | OpenAI.Chat.Completions.ChatCompletionMessageToolCall
    | undefined;

  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || "";
    const currentToolCall = chunk.choices[0]?.delta?.tool_calls?.[0];

    if (content) {
      process.stdout.write(content);
      accumulatedContent += content;
    }

    if (currentToolCall) {
      if (!toolCall) {
        toolCall = {
          id: currentToolCall.id || "",
          type: "function",
          function: {
            name: currentToolCall.function?.name || "",
            arguments: currentToolCall.function?.arguments || "",
          },
        };
      } else {
        if (currentToolCall.function?.arguments) {
          toolCall.function.arguments += currentToolCall.function.arguments;
        }
      }
    }
  }

  return { accumulatedContent, toolCall };
}

async function startChat() {
  rl.question("You: ", async (input) => {
    messages.push({ role: "user", content: input });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: [
        {
          type: "function",
          function: functionSpecs[0],
        },
      ],
      tool_choice: "auto",
      stream: true,
    });

    const { accumulatedContent, toolCall } = await processStreamResponse(
      response
    );

    if (toolCall) {
      const { messages: newMessages } = await handleToolCall(toolCall);
      messages.push(...newMessages);
    } else if (accumulatedContent) {
      process.stdout.write("\n");
      messages.push({ role: "assistant", content: accumulatedContent });
    }

    startChat();
  });
}

console.log("Start chatting with AI! (Type 'exit' to quit)");
startChat();

rl.on("close", () => {
  console.log("👋 Goodbye!");
  process.exit(0);
});
