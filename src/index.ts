import { OpenAI } from "openai";
import * as readline from "readline";
import * as dotenv from "dotenv";
import {
  functionSpecs,
  generateWarmupMessage,
  generateContextualMessage,
  generateFollowUpMessage,
  archiveProspect,
  moveToStage1,
  setCurrentProspectId,
  setStateActor,
  classifyProspectResponse,
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

const TEMPERATURE = 0.2;

// Initialize state machine and set global prospect ID
const prospectId = "PROSPECT_JOHN_DOE";
setCurrentProspectId(prospectId);

const actor = createActor(stage0AColdProspect, {
  input: { prospectId },
}).start();

// Set the actor reference for state transitions
setStateActor(actor);

// Listen for state changes and update system message
actor.subscribe((state) => {
  console.log(`\n🔄 State changed to: ${state.value}`);

  // Update the system message when state changes
  if (messages.length > 1) {
    messages[1] = {
      role: "system",
      content: getCurrentStateInstructions(),
    };
  }
});

// Static system prompt that defines Steve's persona
const STEVE_PERSONA = `You are Steve, an AI assistant helping salespeople manage their prospects. You are professional, focused, and excellent at understanding prospect responses and suggesting appropriate next steps.

Your primary responsibilities are:
1. Help salespeople interpret prospect responses and decide on next actions
2. Generate messages for the salesperson to send to prospects
3. Maintain a natural, professional conversation flow
4. Guide prospects towards asking about the business while keeping engagement genuine

You communicate clearly with salespeople about:
- What state the prospect is in
- What the next steps should be
- Why you recommend certain actions

You are direct and practical in your advice, but always maintain a helpful and supportive tone. 
Before making any function calls, always first suggest the action in natural language.
Never trigger function calls without a preceding suggestion message.
Triiger appropiate function calls if user asks for it or if you think it is appropriate.`;

// Helper to get state metadata
function getStateMetadata(snapshot: SnapshotFrom<typeof stage0AColdProspect>) {
  const currentState = snapshot.value as string;
  const stateNode = stage0AColdProspect.states[currentState];
  return stateNode?.meta ?? { prompt: "", allowedTools: [] as Tool[] };
}

// Helper to get the current state instructions
function getCurrentStateInstructions() {
  const state = actor.getSnapshot();
  const { prompt, allowedTools } = getStateMetadata(state);

  return `Current Prospect: ${prospectId} (John Doe)
Current State: ${state.value}

CURRENT INSTRUCTIONS:
${prompt}

${
  state.value === "collectFeedback"
    ? `
CLASSIFICATION REQUIRED:
When user tells you about the prospect's response, you must classify it using the classifyProspectResponse function with one of these classifications:
- ASKED_ABOUT_BUSINESS: If they explicitly asked about your business/work
- POSITIVE_OR_NEUTRAL: If they engaged positively but didn't ask about business
- NO_RESPONSE: If there was no response from the prospect
- NEGATIVE_RESPONSE: If they responded negatively
`
    : `
ACTIONS AVAILABLE:
The current state allows these tools: ${allowedTools.join(", ")}
Use the appropriate tool based on the current state instructions.
`
}

Please help user understand the current situation and take appropriate action based on the state instructions above.`;
}

let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  {
    role: "system",
    content: STEVE_PERSONA,
  },
  {
    role: "system",
    content: getCurrentStateInstructions(),
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

  console.log(
    "Waiting for frontend to response to the tool call...: ",
    JSON.stringify(toolCall.function)
  );
  await new Promise((resolve) => setTimeout(resolve, 6000));

  switch (toolCall.function.name) {
    case "generateWarmupMessage":
      functionResponse = generateWarmupMessage();
      break;
    case "generateContextualMessage":
      functionResponse = generateContextualMessage();
      break;
    case "generateFollowUpMessage":
      functionResponse = generateFollowUpMessage();
      break;
    case "archiveProspect":
      functionResponse = archiveProspect();
      break;
    case "moveToStage1":
      functionResponse = moveToStage1();
      break;
    case "classifyProspectResponse":
      functionResponse = classifyProspectResponse(args);
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
    temperature: TEMPERATURE,
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
  const { allowedTools } = getStateMetadata(state);

  // Use the tools defined by the state machine
  const availableTools = allowedTools;

  console.log(`\nCurrent State: ${state.value}`);
  console.log(`Available Tools: ${availableTools.join(", ")}`);

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
        .filter((tool) => availableTools.includes(tool.function.name)),
      tool_choice: availableTools.length > 0 ? "auto" : "none",
      stream: true,
      temperature: TEMPERATURE,
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
console.log(`Initial State: ${actor.getSnapshot().value}`);
const { prompt, allowedTools } = getStateMetadata(actor.getSnapshot());
console.log(`State Instructions: ${prompt}`);
console.log(`Available Tools: ${allowedTools.join(", ")}`);
startChat();

rl.on("close", () => {
  console.log("👋 Goodbye!");
  process.exit(0);
});
