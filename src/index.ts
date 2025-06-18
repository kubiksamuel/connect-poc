import { OpenAI } from "openai";
import * as readline from "readline";
import * as dotenv from "dotenv";
import {
  functionSpecs,
  sendMessageWarmup,
  sendMessageContextual,
  sendFollowUp,
  archiveProspect,
  moveToStage1,
  setCurrentProspectId,
} from "./functions";
import { stage0AColdProspect } from "./stages/stage0A";
import { createActor, SnapshotFrom } from "xstate";
import { Tool } from "./stages/stage0A";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Initialize state machine and set global prospect ID
const prospectId = "PROSPECT_" + Date.now();
setCurrentProspectId(prospectId);

const actor = createActor(stage0AColdProspect, {
  input: { prospectId },
}).start();

// Helper to get state metadata
function getStateMetadata(snapshot: SnapshotFrom<typeof stage0AColdProspect>) {
  const currentState = snapshot.value as string;
  const stateNode = stage0AColdProspect.states[currentState];
  return stateNode?.meta ?? { prompt: "", allowedTools: [] as Tool[] };
}

let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  {
    role: "system",
    content: `You are Steve, an AI assistant helping salespeople manage their prospects. You are currently in Stage 0A of the sales process, working with a cold prospect.

Your goal is to help the salesperson navigate the conversation and make appropriate decisions based on the prospect's responses. You should:

1. Help interpret the prospect's responses and classify them into one of these categories:
   - Asked about business (shows clear interest)
   - Positive/neutral response (engaged but not asking about business yet)
   - No response (needs follow-up)
   - Negative response (should be archived)

2. Suggest appropriate next actions based on the state machine's current state and allowed tools.

3. Provide context and advice to the salesperson about how to handle each situation.

Current Prospect ID: ${prospectId}
Current State: ${actor.getSnapshot().value}
Allowed Tools: ${getStateMetadata(actor.getSnapshot()).allowedTools.join(", ")}

Remember: The goal in Stage 0 is to establish a connection and guide the prospect to ask about what you do for work.`,
  },
];

async function handleStream(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
) {
  const chunks: string[] = [];
  process.stdout.write("Steve: ");

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

  const args = JSON.parse(toolCall.function.arguments || "{}");
  let functionResponse: string;

  switch (toolCall.function.name) {
    case "sendMessageWarmup":
      functionResponse = sendMessageWarmup();
      break;
    case "sendMessageContextual":
      functionResponse = sendMessageContextual(args);
      break;
    case "sendFollowUp":
      functionResponse = sendFollowUp();
      break;
    case "archiveProspect":
      functionResponse = archiveProspect();
      break;
    case "moveToStage1":
      functionResponse = moveToStage1();
      break;
    default:
      console.log(`Unknown function: ${toolCall.function.name}`);
      return result;
  }

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
    model: "gpt-4o-mini",
    messages: [...messages, ...result.messages],
    stream: true,
  });

  const followUpContent = await handleStream(followUpStream);
  result.messages.push({ role: "assistant", content: followUpContent });
  result.response = followUpContent;

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
  const state = actor.getSnapshot();
  const currentState = state.value as string;
  const { allowedTools } = getStateMetadata(state);

  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    messages.push({ role: "user", content: input });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: functionSpecs
        .map((spec) => ({
          type: "function" as const,
          function: spec,
        }))
        .filter((tool) => allowedTools.includes(tool.function.name)),
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

console.log(
  "Start chatting with Steve, your sales assistant! (Type 'exit' to quit)"
);
console.log(`Current State: ${actor.getSnapshot().value}`);
console.log(
  `Allowed Tools: ${getStateMetadata(actor.getSnapshot()).allowedTools.join(
    ", "
  )}`
);
startChat();

rl.on("close", () => {
  console.log("👋 Goodbye!");
  process.exit(0);
});
