// stage0A.coldProspect.machine.ts
import { setup, assign } from "xstate";

/*─────────────────────────────────────────────────────────────*/
/*  Helper types                                               */
export type Tool =
  | "generateWarmupMessage"
  | "generateContextualMessage"
  | "generateFollowUpMessage"
  | "archiveProspect"
  | "moveToStage1"
  | "classifyProspectResponse";

/*─────────────────────────────────────────────────────────────*/
/*  Context & Events                                           */
interface Ctx {
  prospectId: string;
  followUpTries: number; // 0…3
}

type Evt =
  | { type: "ASKED_ABOUT_BUSINESS" }
  | { type: "POSITIVE_OR_NEUTRAL" }
  | { type: "NO_RESPONSE" }
  | { type: "NEGATIVE_RESPONSE" }
  | { type: "MESSAGE_GENERATED" };

/*─────────────────────────────────────────────────────────────*/
/*  Machine definition using XState v5 `setup()`               */
export const stage0AColdProspect = setup({
  /** 🔖  Strong typing for context, events & meta  */
  types: {
    context: {} as Ctx,
    events: {} as Evt,
    meta: {} as {
      prompt: string;
      allowedTools: Tool[];
    },
  },

  /** 🔧  Implementation (actions, guards) */
  actions: {
    incTries: assign({
      followUpTries: ({ context }) => context.followUpTries + 1,
    }),
  },

  guards: {
    hasMoreFollowUps: ({ context }) => context.followUpTries < 3,
  },
}).createMachine({
  id: "stage0AColdProspect",
  initial: "generateWarmup",

  context: {
    prospectId: "<<set-by-caller>>",
    followUpTries: 0,
  },

  states: {
    /* 1️⃣  Generate first warm-up message */
    generateWarmup: {
      on: {
        MESSAGE_GENERATED: { target: "collectFeedback" },
      },
      meta: {
        prompt:
          "You must use the generateWarmupMessage function to create a message for the prospect. Do not provide message suggestions in your response - only use the function call.",
        allowedTools: ["generateWarmupMessage"],
      },
    },

    /* 2️⃣  Wait & classify feedback */
    collectFeedback: {
      on: {
        ASKED_ABOUT_BUSINESS: { target: "moveToStage1" },
        POSITIVE_OR_NEUTRAL: { target: "generateContextual" },
        NO_RESPONSE: { target: "generateFollowUp" },
        NEGATIVE_RESPONSE: { target: "archive" },
      },
      meta: {
        prompt:
          "You must use the classifyProspectResponse function to analyze the prospect's response. Do not provide analysis in your chat response - only use the function call to classify their response type.",
        allowedTools: ["classifyProspectResponse"],
      },
    },

    /* 2b  Generate contextual message, then loop */
    generateContextual: {
      on: {
        MESSAGE_GENERATED: { target: "collectFeedback" },
      },
      meta: {
        prompt:
          "You must use the generateContextualMessage function to create a contextual message. Do not provide message suggestions in your response - only use the function call.",
        allowedTools: ["generateContextualMessage"],
      },
    },

    /* 3️⃣  Generate follow-up (max 3) */
    generateFollowUp: {
      entry: { type: "incTries" },
      on: {
        MESSAGE_GENERATED: { target: "collectFeedback" },
      },
      meta: {
        prompt:
          "You must use the generateFollowUpMessage function to create a follow-up message. Do not provide message suggestions in your response - only use the function call.",
        allowedTools: ["generateFollowUpMessage"],
      },
    },

    /* 4️⃣  Success → pass control to Stage 1 */
    moveToStage1: {
      type: "final",
      meta: {
        prompt:
          "You must use the moveToStage1 function to transition the prospect to Stage 1. Do not provide explanations in your response - only use the function call.",
        allowedTools: ["moveToStage1"],
      },
    },

    /* 5️⃣  Archive path */
    archive: {
      type: "final",
      meta: {
        prompt:
          "You must use the archiveProspect function to archive the prospect. Do not provide explanations in your response - only use the function call.",
        allowedTools: ["archiveProspect"],
      },
    },
  },
});

export default stage0AColdProspect;
