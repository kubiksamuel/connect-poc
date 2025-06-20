// stage0A.coldProspect.machine.ts
import { setup, assign } from "xstate";
import { Ctx, Evt, Tool } from "./stage0A.types";
import { MAX_FOLLOW_UP_ATTEMPTS } from "../prospectData";

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
    resetTries: assign({
      followUpTries: 0,
    }),
  },

  guards: {
    hasMoreFollowUps: ({ context }) =>
      context.followUpTries < MAX_FOLLOW_UP_ATTEMPTS,
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
          "Starting with a new cold prospect. NEXT STEP: If the user clearly wants to generate a message (using words like 'generate', 'create', 'make', 'now', etc.), immediately call generateWarmupMessage function. If they're just greeting or unclear, ask if they want you to generate a warm-up message.",
        allowedTools: ["generateWarmupMessage"],
      },
    },

    /* 2️⃣  Wait & collect feedback */
    collectFeedback: {
      on: {
        ASKED_ABOUT_BUSINESS: {
          target: "stage1",
        },
        POSITIVE_OR_NEUTRAL: {
          target: "generateContextual",
          actions: { type: "resetTries" },
        },
        NO_RESPONSE: [
          {
            target: "generateFollowUp",
            guard: { type: "hasMoreFollowUps" },
          },
          {
            target: "archive",
          },
        ],
        NEGATIVE_RESPONSE: {
          target: "archive",
        },
      },
      meta: {
        prompt:
          "A message has been sent to the prospect. NEXT STEP: Ask if the prospect has responded yet. When the user mentions the prospect responded/replied/answered, immediately call collectFeedback function. If the user already provided the exact response/reply in their message (e.g., 'John replied: Not interested right now'), include that as the feedback parameter. If they just mentioned a response without details (e.g., 'He replied.'), call collectFeedback without parameters to open the input modal. If the user didn't provide feedbaack in chat, always prefer to call collectFeedback with null feedback to open the input modal instead of asking for feedback in chat.",
        allowedTools: ["collectFeedback"],
      },
    },

    /* 3️⃣  Generate contextual message, then loop */
    generateContextual: {
      on: {
        MESSAGE_GENERATED: { target: "collectFeedback" },
      },
      meta: {
        prompt:
          "The prospect responded positively but didn't ask about the business yet. NEXT STEP: IMMEDIATELY call generateContextualMessage function. You are in this state because a contextual message is needed - don't ask permission, just generate it.",
        allowedTools: ["generateContextualMessage"],
      },
    },

    /* 4️⃣  Generate follow-up */
    generateFollowUp: {
      entry: { type: "incTries" },
      on: {
        MESSAGE_GENERATED: { target: "collectFeedback" },
      },
      meta: {
        prompt:
          "The prospect hasn't responded to the previous message. NEXT STEP: IMMEDIATELY call generateFollowUpMessage function. You are in this state because a follow-up is needed - don't ask permission, just generate it.",
        allowedTools: ["generateFollowUpMessage"],
      },
    },

    // /* 5️⃣  Success → pass control to Stage 1 */
    // moveToStage1: {
    //   on: {
    //     STAGE_1_REACHED: { target: "stage1" },
    //   },
    //   meta: {
    //     prompt:
    //       "Great news! The prospect has shown interest in the business. NEXT STEP: IMMEDIATELY call moveToStage1 function. You are in this state because the prospect is ready for Stage 1 - don't ask permission, just move them.",
    //     allowedTools: ["moveToStage1"],
    //   },
    // },

    /* 6️⃣  Archive path */
    archive: {
      on: {
        PROSPECT_ARCHIVED: { target: "prospectArchived" },
      },
      meta: {
        prompt:
          "This prospect hasn't been responsive despite multiple attempts. It's time to focus energy on more promising leads. NEXT STEP: IMMEDIATELY trigger function call for archiveProspect. Be empathetic and encouraging - this is a normal part of sales and helps prioritize time effectively.",
        allowedTools: ["archiveProspect"],
      },
    },

    prospectArchived: {
      type: "final",
      meta: {
        prompt:
          "The prospect has been archived. If user wants to renew the prospect, he must go to settings and add the prospect again.",
        allowedTools: [],
      },
    },

    stage1: {
      type: "final",
      meta: {
        prompt:
          "The prospect has been moved to stage 1. You have to describe what to do now - present a product and invite to private or company call",
        allowedTools: [],
      },
    },
  },
});

export default stage0AColdProspect;
