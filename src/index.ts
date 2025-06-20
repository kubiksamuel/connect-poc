import { OpenAI } from "openai";
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
import { getProspectContext } from "./prospectData";
import { rl } from "./terminal";

export const TEMPERATURE = 0.8;

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
4. When users ask for actions outside your current capabilities, explain the process positively

# COMMUNICATION STYLE
- Be warm, encouraging, and professional
- Explain the "why" behind the process when users ask for unavailable actions
- Use phrases like "Great question!", "I understand why you'd want to...", "Let me explain how this works..."
- Frame limitations as part of a smart, systematic approach
- Always end with a positive next step

# HANDLING OUT-OF-SCOPE REQUESTS
When users ask for actions you can't do right now:
- Acknowledge their request positively
- Briefly explain why we follow this sequence
- Redirect to what we CAN do next
- Keep it conversational and supportive

Example: "I understand you'd like to archive John! The way our process works is we start with the initial outreach first, then based on how he responds, we'll know whether to continue or archive. Right now, I can help you create that first warm-up message - shall we get started?"

# FUNCTION CALLING REQUIREMENTS
- If user wants to generate a message and you have generateWarmupMessage/generateContextualMessage/generateFollowUpMessage available → CALL THE FUNCTION
- If user mentions prospect responded and you have collectFeedback available → CALL collectFeedback
- If you're in archive state with archiveProspect available → CALL archiveProspect IMMEDIATELY
- If you're in moveToStage1 state with moveToStage1 available → CALL moveToStage1 IMMEDIATELY
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
- If you say something like "I'll do that now" → Call function immediately without asking
- Unclear request → Ask for clarification first

# CRITICAL: IMMEDIATE FUNCTION CALLS
When your state instructions contain "IMMEDIATELY call [functionName]", you MUST call that function right away. Do NOT say "I'll do that now" and then wait - actually DO IT by calling the function. Either ask for confirmation or call the function immediately.

  In this chat you help salesman with this prospect:
  ${getProspectContext()}
`;

// Helper to get state metadata
function getStateMetadata(snapshot: SnapshotFrom<typeof stage0AColdProspect>) {
  const currentState = snapshot.value as string;
  const stateNode = stage0AColdProspect.states[currentState];
  return stateNode?.meta ?? { prompt: "", allowedTools: [] as Tool[] };
}

// Helper to get the current state instructions from the state machine
function getCurrentStateInstructions() {
  const state = actor.getSnapshot();
  const { prompt } = getStateMetadata(state);
  return "CURRENT STATE IN FLOW: " + prompt;
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
    response: "Function is not available",
  };

  const args = JSON.parse(toolCall.function.arguments || "{}");
  const functionName = toolCall.function.name;
  let functionResponse: string;

  console.log("FUNCTION_CALL: ", JSON.stringify({ name: functionName, args }));
  await new Promise((resolve) => setTimeout(resolve, 6000));

  switch (functionName) {
    case "generateWarmupMessage":
      const warmupResponse = await generateWarmupMessage();
      functionResponse = JSON.stringify(warmupResponse, null, 2);
      break;
    case "generateContextualMessage":
      const contextualResponse = await generateContextualMessage();
      functionResponse = JSON.stringify(contextualResponse, null, 2);
      break;
    case "generateFollowUpMessage":
      const followUpResponse = await generateFollowUpMessage();
      functionResponse = JSON.stringify(followUpResponse, null, 2);
      break;
    case "collectFeedback":
      functionResponse = await collectFeedback(args.feedback);
      break;
    case "archiveProspect":
      functionResponse = archiveProspect();
      break;
    case "moveToStage1":
      functionResponse = moveToStage1();
      break;
    default:
      console.log(`Unknown function: ${functionName}`);
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

  console.log("-------------------------------");
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
