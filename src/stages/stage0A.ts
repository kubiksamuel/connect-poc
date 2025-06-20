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
          "Help the user create a warm-up message for their prospect. When they're ready to generate the message, you MUST call the generateWarmupMessage function.",
        allowedTools: ["generateWarmupMessage"],
      },
    },

    /* 2️⃣  Wait & collect feedback */
    collectFeedback: {
      on: {
        ASKED_ABOUT_BUSINESS: { target: "moveToStage1" },
        POSITIVE_OR_NEUTRAL: { target: "generateContextual" },
        NO_RESPONSE: [
          {
            target: "generateFollowUp",
            guard: { type: "hasMoreFollowUps" },
          },
          {
            target: "archive",
          },
        ],
        NEGATIVE_RESPONSE: { target: "archive" },
      },
      meta: {
        prompt:
          "Collect the prospect's response. When the user mentions the prospect responded/replied/answered, you MUST call the collectFeedback function. The function will automatically classify the feedback and transition to the appropriate next state.",
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
          "Create a contextual message to keep the prospect engaged. When ready to generate the message, you MUST call the generateContextualMessage function.",
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
          "Create a follow-up message for the unresponsive prospect. When ready to generate the message, you MUST call the generateFollowUpMessage function.",
        allowedTools: ["generateFollowUpMessage"],
      },
    },

    /* 5️⃣  Success → pass control to Stage 1 */
    moveToStage1: {
      on: {
        STAGE_1_REACHED: { target: "stage1" },
      },
      meta: {
        prompt:
          "The prospect has shown interest! You MUST call the moveToStage1 function to advance them to the next stage.",
        allowedTools: ["moveToStage1"],
      },
    },

    /* 6️⃣  Archive path */
    archive: {
      on: {
        PROSPECT_ARCHIVED: { target: "prospectArchived" },
      },
      meta: {
        prompt:
          "This prospect needs to be archived. You MUST call the archiveProspect function to archive them.",
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
        prompt: "The prospect has been moved to stage 2.",
        allowedTools: [],
      },
    },
  },
});

export default stage0AColdProspect;
