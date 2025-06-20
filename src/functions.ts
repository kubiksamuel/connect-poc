import { sendRequestToOpenAi } from "./openAiRequest";
import { MAX_FOLLOW_UP_ATTEMPTS, prospectData } from "./prospectData";

// Global prospect ID that will be set when chat starts
export let CURRENT_PROSPECT_ID: string = "";

// Global actor reference that will be set when chat starts
export let stateActor: any = null;

export function setCurrentProspectId(id: string) {
  CURRENT_PROSPECT_ID = id;
}

export function setStateActor(actor: any) {
  stateActor = actor;
}

export type MessageResponse = {
  message?: string;
};

export async function generateWarmupMessage(): Promise<string> {
  console.log("FUNCTION_CALL: Generating warmup message");

  const messages = [
    {
      role: "system" as const,
      content: `You are a sales message expert.
       Generate a personalized, professional warm-up message for cold outreach.
       Prospect data: ${JSON.stringify(prospectData)}
       Generate only message, no other text.`,
    },
  ];

  const warmupMessage = await sendRequestToOpenAi(messages);

  // After generating warmup message, transition to collectFeedback
  if (stateActor) {
    stateActor.send({ type: "MESSAGE_GENERATED" });
  }

  // console.log(
  //   "#FRONTEND: Warm up message generated:",
  //   warmupMessage,
  //   "END #FRONTEND"
  // );

  return warmupMessage;
}

export async function generateContextualMessage(): Promise<string> {
  // In a real implementation, this would generate a contextual message to nudge the prospect
  console.log("FUNCTION_CALL: Generating contextual message");

  const messages = [
    {
      role: "system" as const,
      content: `You are a sales message expert.
       Generate a personalized, professional contextual message for cold outreach.
       Prospect data: ${JSON.stringify(prospectData)}
       Generate only message, no other text.`,
    },
  ];

  const contextualMessage = await sendRequestToOpenAi(messages);

  // After generating contextual message, transition back to collectFeedback
  if (stateActor) {
    stateActor.send({ type: "MESSAGE_GENERATED" });
  }

  // console.log(
  //   "#FRONTEND: Contextual message generated:",
  //   contextualMessage,
  //   "END #FRONTEND"
  // );

  return contextualMessage;
}

export function generateFollowUpMessage(): string {
  // In a real implementation, this would generate a follow-up message
  console.log("FUNCTION_CALL: Generating follow-up message");

  // Check if we've reached the maximum follow-up attempts
  if (stateActor) {
    const currentState = stateActor.getSnapshot();
    const followUpTries = currentState.context.followUpTries;

    console.log(`Current follow-up tries: ${followUpTries}`);

    // If we've reached 3 follow-ups, don't generate another message
    // if (followUpTries >= 3) {
    //   console.log("🔄 Maximum follow-ups reached - transitioning to archive");
    //   stateActor.send({ type: "MESSAGE_GENERATED" });
    //   return "Maximum follow-up attempts reached. This prospect should be archived due to lack of response.";
    // }
  }

  const followUpMessage = `Hi again! Just wanted to follow up on my previous message. Hope you're doing well!`;

  // After generating follow-up message, let the state machine decide next step based on follow-up count
  if (stateActor) {
    // setTimeout(() => {
    console.log(
      "🔄 Triggering MESSAGE_GENERATED - state machine will decide next step based on follow-up count"
    );
    stateActor.send({ type: "MESSAGE_GENERATED" });
    // }, 100);
  }

  return followUpMessage;
  //   return `I've generated a follow-up message for John:

  // "${followUpMessage}"

  // This is a gentle follow-up that:
  // - Maintains a friendly tone
  // - Shows continued interest
  // - Doesn't pressure the prospect

  // You can send this message to John. The system will automatically handle whether to continue with more follow-ups or archive based on response patterns.`;
}

export function archiveProspect(): string {
  // In a real implementation, this would archive the prospect in the CRM
  console.log("FUNCTION_CALL: Archiving prospect");
  if (stateActor) {
    stateActor.send({ type: "PROSPECT_ARCHIVED" });
  }

  // This is a final action - no state transition needed
  return `Archived prospect ${CURRENT_PROSPECT_ID}. This prospect has been marked as unresponsive and removed from active outreach.`;
}

export function moveToStage1(): string {
  // In a real implementation, this would move the prospect to Stage 1 in the CRM
  console.log("FUNCTION_CALL: Moving to stage 1");

  if (stateActor) {
    stateActor.send({ type: "STAGE_1_REACHED" });
  }

  // This is a final action - no state transition needed
  return `Moved prospect ${CURRENT_PROSPECT_ID} to Stage 1. The prospect has shown interest and is ready for deeper business discussions.`;
}

export async function collectFeedback(feedback?: string): Promise<string> {
  // In a real implementation, this would trigger a modal on the frontend to collect prospect's feedback
  console.log("FUNCTION_CALL: Triggering feedback collection modal");

  if (!feedback) {
    return "Error: No feedback provided";
  }

  console.log("🔄 Feedback received:", feedback);

  // Automatically classify the feedback and trigger state transition
  const classification = await autoClassifyFeedback(feedback);
  console.log("🔄 Auto-classified as:", classification);

  let response = "";
  switch (classification) {
    case "ASKED_ABOUT_BUSINESS":
      response =
        "Great! The prospect asked about your business - moving to Stage 1.";
      break;
    case "POSITIVE_OR_NEUTRAL":
      response =
        "The prospect responded positively - I'll generate a contextual message next.";
      break;
    case "NO_RESPONSE":
      if (stateActor) {
        const currentState = stateActor.getSnapshot();
        const followUpTries = currentState.context.followUpTries;
        if (followUpTries < MAX_FOLLOW_UP_ATTEMPTS) {
          response =
            "No response from prospect - I'll generate a follow-up message.";
        } else {
          response = "Maximum follow-ups reached - archiving this prospect.";
        }
      }
      break;
    case "NEGATIVE_RESPONSE":
      response = "The prospect responded negatively - archiving this prospect.";
      break;
  }

  // Trigger the state transition immediately
  if (stateActor) {
    stateActor.send({ type: classification });
  }

  return `Feedback collected: "${feedback}"

${response}`;
}

// Helper function to automatically classify feedback using OpenAI
async function autoClassifyFeedback(
  feedback: string
): Promise<
  | "ASKED_ABOUT_BUSINESS"
  | "POSITIVE_OR_NEUTRAL"
  | "NO_RESPONSE"
  | "NEGATIVE_RESPONSE"
> {
  // Use OpenAI to intelligently classify the response
  const classificationMessages = [
    {
      role: "system" as const,
      content: `You are an expert sales response classifier. Analyze the prospect's response and classify it into exactly one of these categories:

ASKED_ABOUT_BUSINESS: The prospect is asking about what you do, your business, your company, your work, your services, or showing interest in learning more about your business.

POSITIVE_OR_NEUTRAL: The prospect responded in a friendly, neutral, or engaged way but hasn't specifically asked about your business yet. This includes greetings, acknowledgments, small talk, or showing general interest.

NEGATIVE_RESPONSE: The prospect is clearly not interested, asked to be removed, said no thanks, responded negatively or blocked user.

NO_RESPONSE: Only use this if the salesperson explicitly states there was no response (this should be rare since we pre-filter for this).

Respond with ONLY the valid classification category name, nothing else.`,
    },
    {
      role: "user" as const,
      content: `Classify this prospect response: "${feedback}"`,
    },
  ];

  try {
    const classification = await sendRequestToOpenAi(classificationMessages);

    if (classification) {
      const cleanClassification = classification.trim().toUpperCase();

      // Validate the classification
      if (
        [
          "ASKED_ABOUT_BUSINESS",
          "POSITIVE_OR_NEUTRAL",
          "NO_RESPONSE",
          "NEGATIVE_RESPONSE",
        ].includes(cleanClassification)
      ) {
        return cleanClassification as
          | "ASKED_ABOUT_BUSINESS"
          | "POSITIVE_OR_NEUTRAL"
          | "NO_RESPONSE"
          | "NEGATIVE_RESPONSE";
      }
    }
  } catch (error) {
    console.error("Error classifying feedback with OpenAI:", error);
  }

  // Fallback to positive/neutral if OpenAI classification fails
  console.log(
    "⚠️ OpenAI classification failed, defaulting to POSITIVE_OR_NEUTRAL"
  );
  return "POSITIVE_OR_NEUTRAL";
}

export const functionSpecs = [
  {
    name: "generateWarmupMessage",
    description:
      "Generate an initial warm-up message for the user to send to a cold prospect.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "generateContextualMessage",
    description:
      "Generate a contextual message based on previous interaction for the user to send.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The contextual message content to generate",
        },
      },
      required: [],
    },
  },
  {
    name: "generateFollowUpMessage",
    description:
      "Generate a follow-up message for the user to send to an unresponsive prospect.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "archiveProspect",
    description: "Archive a prospect after negative feedback or no response.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "moveToStage1",
    description: "Move a prospect to Stage 1 when they show interest.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "collectFeedback",
    description:
      "Triggers the UI to collect the prospect's reply. A modal will open where the salesperson can paste or dictate the message. This function automatically classifies the feedback and transitions to the appropriate next state.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
