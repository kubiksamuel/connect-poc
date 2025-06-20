import { sendRequestToOpenAi } from "./openAiRequest";
import { MAX_FOLLOW_UP_ATTEMPTS, getProspectContext } from "./prospectData";
import { askQuestion } from "./terminal";

// Enum for prospect response classifications
export enum ProspectResponseClassification {
  ASKED_ABOUT_BUSINESS = "ASKED_ABOUT_BUSINESS",
  POSITIVE_OR_NEUTRAL = "POSITIVE_OR_NEUTRAL",
  NO_RESPONSE = "NO_RESPONSE",
  NEGATIVE_RESPONSE = "NEGATIVE_RESPONSE",
}

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

// New type for multi-format messages
export type MultiFormatMessage = {
  voiceMessage: string;
  textMessage: string;
  callContent: string;
};

export type MessageResponse = {
  message?: string;
};

export async function generateWarmupMessage(): Promise<MultiFormatMessage> {
  const messages = [
    {
      role: "system" as const,
      content: `You are a sales message expert. Generate a personalized, professional warm-up message for cold outreach in three different formats.

Information about the prospect: ${getProspectContext()}

Generate three versions optimized for different communication channels:
1. voiceMessage: Conversational tone for voice messages (30-45 seconds when spoken, natural and friendly)
2. textMessage: Concise, professional text message (SMS/WhatsApp style, under 160 characters)
3. callContent: Phone call script with natural conversation flow (opening line for a phone call)

Each message should be personalized based on the prospect information and appropriate for cold outreach.

Respond with a JSON object in this exact format:
{
  "voiceMessage": "Your voice message content here...",
  "textMessage": "Your text message content here...",
  "callContent": "Your call script content here..."
}`,
    },
  ];

  try {
    const response = await sendRequestToOpenAi(messages);

    if (response) {
      const parsed = JSON.parse(response.trim()) as MultiFormatMessage;

      // Validate the response has all required fields
      if (parsed.voiceMessage && parsed.textMessage && parsed.callContent) {
        // Trigger state transition
        if (stateActor) {
          stateActor.send({ type: "MESSAGE_GENERATED" });
        }

        return parsed;
      }
    }
  } catch (error) {
    console.error("Error parsing multi-format warmup message:", error);
  }

  // Fallback to basic messages if JSON parsing fails
  const fallbackMessage =
    "Hi! I'd love to connect and share something that might be valuable for your business.";

  if (stateActor) {
    stateActor.send({ type: "MESSAGE_GENERATED" });
  }

  return {
    voiceMessage: `Hey there! ${fallbackMessage} Would love to chat when you have a moment.`,
    textMessage: fallbackMessage,
    callContent: `Hi, is this a good time to talk? ${fallbackMessage}`,
  };
}

export async function generateContextualMessage(): Promise<MultiFormatMessage> {
  const messages = [
    {
      role: "system" as const,
      content: `You are a sales message expert. Generate a personalized, professional contextual message for cold outreach in three different formats.

This is a FOLLOW-UP message - the prospect has responded positively but hasn't asked about business yet. Build on the previous interaction and gently guide toward business discussion.

Information about the prospect: ${getProspectContext()}

Generate three versions optimized for different communication channels:
1. voiceMessage: Conversational tone for voice messages (30-45 seconds when spoken, builds rapport)
2. textMessage: Concise, professional text message (SMS/WhatsApp style, under 160 characters)
3. callContent: Phone call script with natural conversation flow (continuation of previous interaction)

Each message should acknowledge the previous positive interaction and move the conversation forward.

Respond with a JSON object in this exact format:
{
  "voiceMessage": "Your voice message content here...",
  "textMessage": "Your text message content here...",
  "callContent": "Your call script content here..."
}`,
    },
  ];

  try {
    const response = await sendRequestToOpenAi(messages);

    if (response) {
      const parsed = JSON.parse(response.trim()) as MultiFormatMessage;

      // Validate the response has all required fields
      if (parsed.voiceMessage && parsed.textMessage && parsed.callContent) {
        // Trigger state transition
        if (stateActor) {
          stateActor.send({ type: "MESSAGE_GENERATED" });
        }

        return parsed;
      }
    }
  } catch (error) {
    console.error("Error parsing multi-format contextual message:", error);
  }

  // Fallback to basic messages if JSON parsing fails
  const fallbackMessage =
    "Thanks for your response! I'd love to share how we've helped similar companies in your industry.";

  if (stateActor) {
    stateActor.send({ type: "MESSAGE_GENERATED" });
  }

  return {
    voiceMessage: `Hey! ${fallbackMessage} Would be great to have a quick chat about it.`,
    textMessage: fallbackMessage,
    callContent: `Hi again! ${fallbackMessage} Do you have a few minutes to discuss?`,
  };
}

export async function generateFollowUpMessage(): Promise<MultiFormatMessage> {
  let followUpAttempt = 1;

  // Check current follow-up attempt number
  if (stateActor) {
    const currentState = stateActor.getSnapshot();
    followUpAttempt = currentState.context.followUpTries + 1;
    console.log(
      `Current follow-up tries: ${currentState.context.followUpTries}`
    );
  }

  const messages = [
    {
      role: "system" as const,
      content: `You are a sales message expert. Generate a personalized, professional follow-up message for cold outreach in three different formats.

This is FOLLOW-UP #${followUpAttempt} - the prospect hasn't responded to previous message(s). Keep it friendly but persistent, varying the approach based on the attempt number.

Information about the prospect: ${getProspectContext()}

Generate three versions optimized for different communication channels:
1. voiceMessage: Conversational tone for voice messages (30-45 seconds when spoken, friendly persistence)
2. textMessage: Concise, professional text message (SMS/WhatsApp style, under 160 characters)
3. callContent: Phone call script with natural conversation flow (acknowledging previous attempts)

Each message should be appropriate for follow-up attempt #${followUpAttempt} and maintain professionalism while showing persistence.

Respond with a JSON object in this exact format:
{
  "voiceMessage": "Your voice message content here...",
  "textMessage": "Your text message content here...",
  "callContent": "Your call script content here..."
}`,
    },
  ];

  try {
    const response = await sendRequestToOpenAi(messages);

    if (response) {
      const parsed = JSON.parse(response.trim()) as MultiFormatMessage;

      // Validate the response has all required fields
      if (parsed.voiceMessage && parsed.textMessage && parsed.callContent) {
        // Trigger state transition
        if (stateActor) {
          console.log(
            "🔄 Triggering MESSAGE_GENERATED - state machine will decide next step based on follow-up count"
          );
          stateActor.send({ type: "MESSAGE_GENERATED" });
        }

        return parsed;
      }
    }
  } catch (error) {
    console.error("Error parsing multi-format follow-up message:", error);
  }

  // Fallback to basic messages if JSON parsing fails
  const fallbackVoiceMessage = `Hi again! Just wanted to follow up on my previous message. Hope you're doing well and would love to connect when you have a moment.`;
  const fallbackTextMessage = `Hi! Just following up on my previous message. Hope you're doing well!`;
  const fallbackCallContent = `Hi, I tried reaching out earlier and wanted to follow up. Is this a good time to chat briefly?`;

  if (stateActor) {
    console.log(
      "🔄 Triggering MESSAGE_GENERATED - state machine will decide next step based on follow-up count"
    );
    stateActor.send({ type: "MESSAGE_GENERATED" });
  }

  return {
    voiceMessage: fallbackVoiceMessage,
    textMessage: fallbackTextMessage,
    callContent: fallbackCallContent,
  };
}

export function archiveProspect(): string {
  // In a real implementation, this would archive the prospect in the CRM
  if (stateActor) {
    stateActor.send({ type: "PROSPECT_ARCHIVED" });
  }

  // This is a final action - no state transition needed
  return `Archived prospect ${CURRENT_PROSPECT_ID}. This prospect has been marked as unresponsive and removed from active outreach.`;
}

export function moveToStage1(): string {
  // In a real implementation, this would move the prospect to Stage 1 in the CRM
  if (stateActor) {
    stateActor.send({ type: "STAGE_1_REACHED" });
  }

  // This is a final action - no state transition needed
  return `Moved prospect ${CURRENT_PROSPECT_ID} to Stage 1. The prospect has shown interest and is ready for deeper business discussions.`;
}

export async function collectFeedback(feedback?: string): Promise<string> {
  let actualFeedback = feedback;

  // If no feedback provided, collect it from user input
  if (!actualFeedback) {
    console.log("\n🔔 MODAL OPENED: Please enter the prospect's response:");

    // Use the shared terminal interface
    actualFeedback = await askQuestion("Prospect's response: ");

    if (!actualFeedback) {
      return "Error: No feedback provided";
    }
  } else {
    console.log("\n✅ Using feedback from chat:", actualFeedback);
  }

  console.log("🔄 Feedback received:", actualFeedback);

  // Automatically classify the feedback and trigger state transition
  const classificationResult = await autoClassifyFeedback(actualFeedback);
  console.log(
    "🔄 Auto-classified as:",
    classificationResult.classifiedCategory
  );
  console.log("🔄 Reasoning:", classificationResult.description);

  // Handle special logic for NO_RESPONSE case (follow-up attempts check)
  let nextAction = "";
  if (
    classificationResult.classifiedCategory ===
      ProspectResponseClassification.NO_RESPONSE &&
    stateActor
  ) {
    const currentState = stateActor.getSnapshot();
    const followUpTries = currentState.context.followUpTries;
    if (followUpTries < MAX_FOLLOW_UP_ATTEMPTS) {
      nextAction = "I'll generate a follow-up message.";
    } else {
      nextAction =
        "Maximum consecutive follow-ups reached - you are going to archive this prospect.";
    }
  }

  // Trigger the state transition immediately
  if (stateActor) {
    stateActor.send({ type: classificationResult.classifiedCategory });
  }

  return `Feedback collected: "${actualFeedback}"

Classification: ${classificationResult.classifiedCategory}
Reasoning: ${classificationResult.description}${
    nextAction ? `\n\nNext Action: ${nextAction}` : ""
  }`;
}

// Type for classification result with reasoning
type ClassificationResult = {
  classifiedCategory: ProspectResponseClassification;
  description: string;
};

// Helper function to automatically classify feedback using OpenAI
async function autoClassifyFeedback(
  feedback: string
): Promise<ClassificationResult> {
  // Use OpenAI to intelligently classify the response
  const classificationMessages = [
    {
      role: "system" as const,
      content: `You are an expert sales response classifier. Analyze the prospect's response and classify it into exactly one of these categories:

ASKED_ABOUT_BUSINESS: The prospect is asking about what you do, your business, your company, your work, your services, OR expressing clear interest in doing business together, wanting to collaborate, or showing readiness to engage in business discussions.
Examples: "What does your company do?", "Tell me more about your services", "I want to do business with you", "Let's collaborate", "I'm interested in working together", "Let's discuss business opportunities"

POSITIVE_OR_NEUTRAL: The prospect responded in a friendly, neutral, or engaged way but hasn't specifically asked about your business or expressed clear business interest yet. This includes greetings, acknowledgments, small talk, or showing general interest without business intent.
Examples: "Hi there!", "Thanks for reaching out", "Nice to meet you", "How are you?", "That sounds interesting" (without business context)

NEGATIVE_RESPONSE: The prospect is clearly not interested, asked to be removed, said no thanks, responded negatively or blocked user.
Examples: "Not interested", "Remove me from your list", "Don't contact me again", "No thanks"

NO_RESPONSE: Only use this if the salesperson explicitly states there was no response (this should be rare since we pre-filter for this).

Respond with a JSON object in this exact format:
{
  "classifiedCategory": "CATEGORY_NAME",
  "description": "Brief explanation of why this response fits this category"
}`,
    },
    {
      role: "user" as const,
      content: `Classify this prospect response: "${feedback}"`,
    },
  ];

  try {
    const response = await sendRequestToOpenAi(classificationMessages);

    if (response) {
      const parsed = JSON.parse(response.trim());

      // Validate the classification
      if (
        parsed.classifiedCategory &&
        parsed.description &&
        Object.values(ProspectResponseClassification).includes(
          parsed.classifiedCategory
        )
      ) {
        return {
          classifiedCategory:
            parsed.classifiedCategory as ProspectResponseClassification,
          description: parsed.description,
        };
      }
    }
  } catch (error) {
    console.error("Error classifying feedback with OpenAI:", error);
  }

  // Fallback to positive/neutral if OpenAI classification fails
  console.log(
    "⚠️ OpenAI classification failed, defaulting to POSITIVE_OR_NEUTRAL"
  );
  return {
    classifiedCategory: ProspectResponseClassification.POSITIVE_OR_NEUTRAL,
    description:
      "Classification failed, defaulting to neutral response for safety",
  };
}

export const functionSpecs = [
  {
    name: "generateWarmupMessage",
    description:
      "Generate an initial warm-up message in three formats (voice message, text message, and call script) for the user to send to a cold prospect.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "generateContextualMessage",
    description:
      "Generate a contextual message in three formats (voice message, text message, and call script) based on previous positive interaction for the user to send.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "generateFollowUpMessage",
    description:
      "Generate a follow-up message in three formats (voice message, text message, and call script) for the user to send to an unresponsive prospect.",
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
      "Collect and classify the prospect's response. If the user has already provided the prospect's response in the chat, pass it directly as the feedback parameter. If no feedback is provided, it will trigger the UI modal for the user to input the response.",
    parameters: {
      type: "object",
      properties: {
        feedback: {
          type: ["string", "null"],
          description:
            "The prospect's response/reply that the user mentioned in the chat. Only include this if the user has clearly stated what the prospect said/wrote back, otherwise set it to null.",
        },
      },
      required: ["feedback"],
      strict: true,
    },
  },
];
