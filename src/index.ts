import { OpenAI } from "openai";
import * as readline from "readline";
import {
  functionSpecs,
  generateWarmupMessage,
  generateContextualMessage,
  generateFollowUpMessage,
  collectFeedback,
  classifyFeedback,
  archiveProspect,
  moveToStage1,
  setCurrentProspectId,
  setStateActor,
} from "./functions";
import { stage0AColdProspect } from "./stages/stage0A";
import { createActor, SnapshotFrom } from "xstate";
import { Tool } from "./stages/stage0A.types";
import { openaiClient } from "./openAIClient";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const TEMPERATURE = 0.8;

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

// - Don't call functions immediately - have a conversation first
// Static system prompt that defines Steve's persona
const STEVE_PERSONA = `You are Steve, a professional sales assistant who helps salespeople convert prospects.

Your role is to:
- Help generate effective messages to send to prospects
- Analyze prospect responses to understand their level of interest
- Provide strategic advice on next steps in the sales process
- Guide the salesperson through proven sales methodologies

You communicate in a natural, conversational way. You're helpful, strategic, and focused on results.

CRITICAL PROACTIVE BEHAVIOR:
- You should ALWAYS propose the next step based on the current state instructions
- Don't wait for the user to ask - actively guide them through the sales process
- When you greet the user or respond to their messages, immediately suggest what they should do next based on the current state
- Be specific about what action they should take and offer to help execute it

CRITICAL FUNCTION CALLING BEHAVIOR:
- When a user indicates they want to perform an action that has a corresponding function available, you MUST call that function IMMEDIATELY
- FEEDBACK COLLECTION PROCESS (2 steps):
  1. When the user mentions the prospect responded/replied/answered, you MUST call collectFeedback to open the modal
  2. After the modal opens and user provides the feedback details, you MUST call classifyFeedback with the appropriate classification
- If the user asks you to generate/create a message, you MUST call the appropriate generation function RIGHT AWAY
- If the user wants to move to next stage or archive, you MUST call those functions IMMEDIATELY
- Don't just talk about what you could do - actually do it by calling the function
- You can have brief conversation, but when it's time for action, always use the available functions

FUNCTION CALLING PROTOCOL:
1. When you suggest doing something that requires a function call, ALWAYS follow this pattern:
   - Make a brief introduction: "Let me generate that message for you now."
   - IMMEDIATELY call the function (don't wait for permission)
2. If the action might be disruptive or the user might want to provide input first, ask for confirmation:
   - "Would you like me to generate a warm-up message for this prospect?"
   - Wait for confirmation, then call the function

Examples of IMMEDIATE function calls (no permission needed):
- User: "John responded" → Say "Let me collect that feedback" → CALL collectFeedback
- User: "Let's create a message" → Say "I'll generate that message now" → CALL appropriate function
- User: "Generate a warm-up" → Say "Creating a warm-up message now" → CALL generateWarmupMessage

Examples of ASK FIRST (when user input might be needed):
- When proactively suggesting: "Would you like me to generate a warm-up message?"
- When the request is ambiguous: "What type of message would you like me to generate?"

The user shouldn't see technical function names or state IDs - use natural language descriptions.

You are direct and practical in your advice, but always maintain a helpful and supportive tone.`;

// Helper to get state metadata
function getStateMetadata(snapshot: SnapshotFrom<typeof stage0AColdProspect>) {
  const currentState = snapshot.value as string;
  const stateNode = stage0AColdProspect.states[currentState];
  return stateNode?.meta ?? { prompt: "", allowedTools: [] as Tool[] };
}

// Helper to get the current state instructions
function getCurrentStateInstructions() {
  const state = actor.getSnapshot();
  const { prompt } = getStateMetadata(state);

  // Provide natural context based on current state
  switch (state.value) {
    case "generateWarmup":
      return "CURRENT STATE: Starting with a new cold prospect. NEXT STEP: You should immediately suggest creating a warm-up message for the prospect. Offer to generate one by calling the generateWarmupMessage function. Be proactive - don't wait for them to ask!";

    case "collectFeedback":
      return "CURRENT STATE: A message has been sent to the prospect. NEXT STEP: You should ask if the prospect has responded yet. When the user mentions the prospect responded/replied/answered, you MUST call the collectFeedback function to collect their actual feedback, then call classifyFeedback to determine the next action.";

    case "generateContextual":
      return "CURRENT STATE: The prospect responded positively but didn't ask about the business yet. NEXT STEP: You should suggest creating a contextual message to keep them engaged. Offer to generate one by calling the generateContextualMessage function.";

    case "generateFollowUp":
      return "CURRENT STATE: The prospect hasn't responded to the previous message. NEXT STEP: You should suggest creating a follow-up message. Offer to generate one by calling the generateFollowUpMessage function.";

    case "moveToStage1":
      return "CURRENT STATE: Great news! The prospect has shown interest in the business. NEXT STEP: You should immediately move them to Stage 1 by calling the moveToStage1 function.";

    case "archive":
      return "CURRENT STATE: This prospect isn't responding positively or has been unresponsive. NEXT STEP: You should archive them by calling the archiveProspect function.";

    default:
      return prompt;
  }
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
    "(Optional) Waiting for frontend to response to the tool call...: ",
    JSON.stringify(toolCall.function)
  );
  await new Promise((resolve) => setTimeout(resolve, 6000));

  switch (toolCall.function.name) {
    case "generateWarmupMessage":
      functionResponse = await generateWarmupMessage();
      break;
    case "generateContextualMessage":
      functionResponse = await generateContextualMessage();
      break;
    case "generateFollowUpMessage":
      functionResponse = generateFollowUpMessage();
      break;
    case "collectFeedback":
      // For testing purposes, simulate the frontend modal with console input
      console.log("\n🔔 MODAL OPENED: Please enter the prospect's response:");

      // Use a simpler approach with the existing readline interface
      const feedbackInput = await new Promise<string>((resolve) => {
        // Pause the main readline temporarily
        rl.pause();

        // Create a temporary readline for feedback input
        const tempRL = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        tempRL.question("Prospect's response: ", (input) => {
          tempRL.close();
          rl.resume(); // Resume the main readline
          resolve(input);
        });
      });

      // Pass the feedback directly to the function
      functionResponse = collectFeedback(feedbackInput);
      break;
    case "classifyFeedback":
      functionResponse = classifyFeedback(args);
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

  const followUpStream = await openaiClient.chat.completions.create({
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

  process.stdout.write("Steve: ");
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

    const response = await openaiClient.chat.completions.create({
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
  "🚀 Welcome! Steve is ready to help you convert prospects. (Type 'exit' to quit)"
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
