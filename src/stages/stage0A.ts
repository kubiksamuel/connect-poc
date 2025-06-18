// stage0A.coldProspect.machine.ts
import { setup, assign } from "xstate";

/*─────────────────────────────────────────────────────────────*/
/*  Helper types & placeholder side-effects                    */
export type Tool =
  | "sendMessageWarmup"
  | "sendMessageContextual"
  | "sendFollowUp"
  | "archiveProspect"
  | "moveToStage1";

const sendMessageWarmup = () => {
  console.log("STATE MACHINE ACTION:Sending warm-up message");
};
const sendMessageContextual = () => {
  console.log("STATE MACHINE ACTION:Sending contextual message");
};
const sendFollowUp = () => {
  console.log("STATE MACHINE ACTION:Sending follow-up message");
};
const archiveProspect = () => {
  console.log("STATE MACHINE ACTION:Archiving prospect");
};
const moveToStage1 = () => {
  console.log("STATE MACHINE ACTION:Moving to stage 1");
};

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
  | { type: "NEGATIVE_RESPONSE" };

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
    sendMessageWarmup,
    sendMessageContextual,
    sendFollowUp,
    archiveProspect,
    moveToStage1,
    incTries: assign({
      followUpTries: ({ context }) => context.followUpTries + 1,
    }),
  },

  guards: {
    hasMoreFollowUps: ({ context }) => context.followUpTries < 3,
  },
}).createMachine({
  id: "stage0AColdProspect",
  initial: "sendWarmup",

  context: {
    prospectId: "<<set-by-caller>>",
    followUpTries: 0,
  },

  states: {
    /* 1️⃣  Send first warm-up ping */
    sendWarmup: {
      entry: { type: "sendMessageWarmup" },
      always: { target: "collectFeedback" },
      meta: {
        prompt: "Send a pre-written warm-up message and wait.",
        allowedTools: ["sendMessageWarmup"],
      },
    },

    /* 2️⃣  Wait & classify feedback */
    collectFeedback: {
      on: {
        ASKED_ABOUT_BUSINESS: { target: "moveToStage1" },
        POSITIVE_OR_NEUTRAL: { target: "sendContextual" },
        NO_RESPONSE: { target: "followUp" },
        NEGATIVE_RESPONSE: { target: "archive" },
      },
      meta: {
        prompt:
          "Evaluate the reply.\n• Asked what you do → Stage 1.\n• Positive/neutral → contextual reply.\n• Silence → follow-up.\n• Negative → archive.",
        allowedTools: [],
      },
    },

    /* 2b  Contextual reply, then loop */
    sendContextual: {
      entry: { type: "sendMessageContextual" },
      always: { target: "collectFeedback" },
      meta: {
        prompt:
          "Send a friendly, contextual message nudging them to ask about your work.",
        allowedTools: ["sendMessageContextual"],
      },
    },

    /* 3️⃣  Follow-up (max 3) */
    followUp: {
      entry: [{ type: "sendFollowUp" }, { type: "incTries" }],
      always: [
        {
          target: "collectFeedback",
          guard: {
            type: "hasMoreFollowUps",
          },
        },
        { target: "archive" },
      ],
      meta: {
        prompt:
          "No reply yet – send follow-up #{{context.followUpTries}} (max 3).",
        allowedTools: ["sendFollowUp"],
      },
    },

    /* 4️⃣  Success → pass control to Stage 1 */
    moveToStage1: {
      entry: { type: "moveToStage1" },
      type: "final",
      meta: {
        prompt: "Prospect asked about business – move to Stage 1.",
        allowedTools: ["moveToStage1"],
      },
    },

    /* 5️⃣  Archive path */
    archive: {
      entry: { type: "archiveProspect" },
      type: "final",
      meta: {
        prompt: "Prospect negative or silent after 3 follow-ups – archive.",
        allowedTools: ["archiveProspect"],
      },
    },
  },
});

export default stage0AColdProspect;
