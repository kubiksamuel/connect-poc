// Global prospect ID that will be set when chat starts
export let CURRENT_PROSPECT_ID: string = "";

export function setCurrentProspectId(id: string) {
  CURRENT_PROSPECT_ID = id;
}

export type MessageResponse = {
  message?: string;
};

export function sendMessageWarmup(): string {
  // In a real implementation, this would send a pre-written warm-up message to the prospect
  console.log("FUNCTION_CALL:Sending warm-up message");
  return `Sent warm-up message to prospect ${CURRENT_PROSPECT_ID}`;
}

export function sendMessageContextual(params: { message?: string }): string {
  // In a real implementation, this would send a contextual message based on previous interaction
  console.log("FUNCTION_CALL:Sending contextual message");
  return `Sent contextual message to prospect ${CURRENT_PROSPECT_ID}: ${
    params.message || ""
  }`;
}

export function sendFollowUp(): string {
  // In a real implementation, this would send a follow-up message to an unresponsive prospect
  console.log("FUNCTION_CALL:Sending follow-up message");
  return `Sent follow-up message to prospect ${CURRENT_PROSPECT_ID}`;
}

export function archiveProspect(): string {
  // In a real implementation, this would archive the prospect in the CRM
  console.log("FUNCTION_CALL:Archiving prospect");
  return `Archived prospect ${CURRENT_PROSPECT_ID}`;
}

export function moveToStage1(): string {
  // In a real implementation, this would move the prospect to Stage 1 in the CRM
  console.log("FUNCTION_CALL:Moving to stage 1");
  return `Moved prospect ${CURRENT_PROSPECT_ID} to Stage 1`;
}

export const functionSpecs = [
  {
    name: "sendMessageWarmup",
    description: "Send an initial warm-up message to a cold prospect.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "sendMessageContextual",
    description: "Send a contextual message based on previous interaction.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The contextual message to send",
        },
      },
      required: [],
    },
  },
  {
    name: "sendFollowUp",
    description: "Send a follow-up message to an unresponsive prospect.",
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
];
