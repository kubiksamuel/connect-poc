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

export function generateWarmupMessage(): string {
  // In a real implementation, this would generate a pre-written warm-up message for the user to send
  console.log("FUNCTION_CALL: Generating warm-up message");

  const warmupMessage = `Hi John! I came across your profile and was impressed by your work in [industry]. I'd love to connect and learn more about what you're working on. Best regards!`;

  // After generating warmup message, transition to collectFeedback
  if (stateActor) {
    // Add a small delay to ensure the message is processed first
    setTimeout(() => {
      console.log(
        "🔄 Transitioning to collectFeedback after warmup message generated"
      );
      // We need to add a custom event for this transition
      stateActor.send({ type: "MESSAGE_GENERATED" });
    }, 100);
  }

  return "Warm up message was generated successfully.";
  // return `Generated warm-up message for prospect ${CURRENT_PROSPECT_ID}:\n\n"${warmupMessage}"\n\nPlease send this message to the prospect.`;
}

export function generateContextualMessage(): string {
  // In a real implementation, this would generate a contextual message to nudge the prospect
  console.log("FUNCTION_CALL: Generating contextual message");

  const contextualMessage = `That's awesome! I've been working on some interesting projects in [related area]. What's been keeping you busy lately?`;

  // After generating contextual message, transition back to collectFeedback
  if (stateActor) {
    setTimeout(() => {
      console.log(
        "🔄 Transitioning to collectFeedback after contextual message generated"
      );
      stateActor.send({ type: "MESSAGE_GENERATED" });
    }, 100);
  }

  // return `Generated contextual message for prospect ${CURRENT_PROSPECT_ID}:\n\n"${contextualMessage}"\n\nPlease send this message to the prospect.`;
  return "Contextual message was generated successfully.";
}

export function generateFollowUpMessage(): string {
  // In a real implementation, this would generate a follow-up message
  console.log("FUNCTION_CALL: Generating follow-up message");

  const followUpMessage = `Hi again! Just wanted to follow up on my previous message. Hope you're doing well!`;

  // After generating follow-up message, check if we should continue or archive
  if (stateActor) {
    setTimeout(() => {
      const currentState = stateActor.getSnapshot();
      const followUpTries = currentState.context.followUpTries;

      console.log(`🔄 Follow-up tries: ${followUpTries}/3`);

      if (followUpTries < 3) {
        console.log(
          "🔄 Transitioning to collectFeedback after follow-up message generated"
        );
        stateActor.send({ type: "MESSAGE_GENERATED" });
      } else {
        console.log("🔄 Max follow-ups reached, archiving prospect");
        // Archive the prospect after max follow-ups
        archiveProspect();
      }
    }, 100);
  }

  // return `Generated follow-up message for prospect ${CURRENT_PROSPECT_ID}:\n\n"${followUpMessage}"\n\nPlease send this message to the prospect.`;
  return "Follow-up message was generated successfully.";
}

export function archiveProspect(): string {
  // In a real implementation, this would archive the prospect in the CRM
  console.log("FUNCTION_CALL: Archiving prospect");

  // This is a final action - no state transition needed
  return `Archived prospect ${CURRENT_PROSPECT_ID}. This prospect has been marked as unresponsive and removed from active outreach.`;
}

export function moveToStage1(): string {
  // In a real implementation, this would move the prospect to Stage 1 in the CRM
  console.log("FUNCTION_CALL: Moving to stage 1");

  // This is a final action - no state transition needed
  return `Moved prospect ${CURRENT_PROSPECT_ID} to Stage 1. The prospect has shown interest and is ready for deeper business discussions.`;
}

// Response classification function that triggers state transitions
export function classifyProspectResponse(params: {
  classification:
    | "ASKED_ABOUT_BUSINESS"
    | "POSITIVE_OR_NEUTRAL"
    | "NO_RESPONSE"
    | "NEGATIVE_RESPONSE";
}): string {
  if (!stateActor) {
    return "Error: State machine not initialized";
  }

  const { classification } = params;

  stateActor.send({ type: classification });

  switch (classification) {
    case "ASKED_ABOUT_BUSINESS":
      return "Prospect showed interest in business - transitioning to Stage 1";
    case "POSITIVE_OR_NEUTRAL":
      return "Prospect responded positively - transitioning to generate contextual message";
    case "NO_RESPONSE":
      return "No response from prospect - transitioning to generate follow-up";
    case "NEGATIVE_RESPONSE":
      return "Prospect responded negatively - transitioning to archive";
    default:
      return "Invalid classification type";
  }
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
    name: "classifyProspectResponse",
    description:
      "Classify the prospect's response to determine the next action in the sales process.",
    parameters: {
      type: "object",
      properties: {
        classification: {
          type: "string",
          enum: [
            "ASKED_ABOUT_BUSINESS",
            "POSITIVE_OR_NEUTRAL",
            "NO_RESPONSE",
            "NEGATIVE_RESPONSE",
          ],
          description:
            "The classification of the prospect's response: ASKED_ABOUT_BUSINESS (they asked about your business/work), POSITIVE_OR_NEUTRAL (engaged positively but didn't ask about business), NO_RESPONSE (no response from prospect), NEGATIVE_RESPONSE (negative response)",
        },
      },
      required: ["classification"],
    },
  },
];
