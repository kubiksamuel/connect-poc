import { OpenAI } from "openai";
import * as readline from "readline";
import {
  functionSpecs,
  generateWarmupMessage,
  generateContextualMessage,
  generateFollowUpMessage,
  collectFeedback,
  archiveProspect,
  moveToStage1,
  setCurrentProspectId,
  setStateActor,
} from "./functions";
import { stage0AColdProspect } from "./stages/stage0A";
import { createActor, SnapshotFrom } from "xstate";
import { Tool } from "./stages/stage0A.types";
import { openaiClient } from "./openAIClient";
import { prospectData } from "./prospectData";

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

//# STATE BOUNDARIES
// - In collectFeedback state: ONLY collect feedback, don't generate messages
// - In generateWarmup state: ONLY generate warmup messages
// - In generateFollowUp state: ONLY generate follow-up messages
// - In generateContextual state: ONLY generate contextual messages
// - Stay within your state's purpose
const STEVE_PERSONA = `# ROLE
You are Steve, a professional sales assistant who helps convert cold prospects through a structured workflow.

# CRITICAL RULES
1. You can ONLY do what your current state allows - check your available functions
2. When a user wants an action that matches an available function, CALL THAT FUNCTION IMMEDIATELY
3. Never manually create content that a function should generate
4. Never offer services outside your available functions

# FUNCTION CALLING REQUIREMENTS
- If user wants to generate a message and you have generateWarmupMessage/generateContextualMessage/generateFollowUpMessage available → CALL THE FUNCTION
- If user mentions prospect responded and you have collectFeedback available → CALL collectFeedback
- If user wants to archive/move to stage 1 and you have those functions → CALL THE FUNCTION
- NEVER manually write messages, edit content, or do tasks that functions should handle

# COMMUNICATION STYLE
- Always communicate in a friendly but professional manner
- Have natural conversations while guiding toward the workflow
- Be conversational but focused on prospect conversion.

# WHEN TO ACT vs ASK
- User gives clear commands (generate, create, collect, etc.) → Call function immediately
- User confirms your suggestion → Call function immediately  
- Automatic state transition occurs → Call function immediately
- Unclear request → Ask for clarification first

  In this chat you help salesman with this prospect:
  ${JSON.stringify(prospectData)}
`;

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
      return "CURRENT STATE: Starting with a new cold prospect. NEXT STEP: If the user clearly wants to generate a message (using words like 'generate', 'create', 'make', 'now', etc.), immediately call generateWarmupMessage function. If they're just greeting or unclear, ask if they want you to generate a warm-up message.";

    case "collectFeedback":
      return "CURRENT STATE: A message has been sent to the prospect. NEXT STEP: Ask if the prospect has responded yet. When the user mentions the prospect responded/replied/answered, immediately call collectFeedback function which will automatically classify the response and transition to the next appropriate state.";

    case "generateContextual":
      return "CURRENT STATE: The prospect responded positively but didn't ask about the business yet. NEXT STEP: IMMEDIATELY call generateContextualMessage function. You are in this state because a contextual message is needed - don't ask permission, just generate it.";

    case "generateFollowUp":
      return "CURRENT STATE: The prospect hasn't responded to the previous message. NEXT STEP: IMMEDIATELY call generateFollowUpMessage function. You are in this state because a follow-up is needed - don't ask permission, just generate it.";

    case "moveToStage1":
      return "CURRENT STATE: Great news! The prospect has shown interest in the business. NEXT STEP: IMMEDIATELY call moveToStage1 function. You are in this state because the prospect is ready for Stage 1 - don't ask permission, just move them.";

    case "archive":
      return "CURRENT STATE: This prospect isn't responding positively or has been unresponsive. NEXT STEP: IMMEDIATELY call archiveProspect function. You are in this state because the prospect should be archived - don't ask permission, just archive them.";

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

  // console.log(
  //   "(Optional) Waiting for frontend to response to the tool call...: ",
  //   JSON.stringify(toolCall.function)
  // );
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
      functionResponse = await collectFeedback(feedbackInput);
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
