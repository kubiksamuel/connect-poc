/*─────────────────────────────────────────────────────────────*/
/*  Helper types                                               */
export type Tool =
  | "generateWarmupMessage"
  | "generateContextualMessage"
  | "generateFollowUpMessage"
  | "collectFeedback"
  | "classifyFeedback"
  | "archiveProspect"
  | "moveToStage1";

/*─────────────────────────────────────────────────────────────*/
/*  Context & Events                                           */
export type Ctx = {
  prospectId: string;
  followUpTries: number; // 0…3
};

export type Evt =
  | { type: "ASKED_ABOUT_BUSINESS" }
  | { type: "POSITIVE_OR_NEUTRAL" }
  | { type: "NO_RESPONSE" }
  | { type: "NEGATIVE_RESPONSE" }
  | { type: "MESSAGE_GENERATED" }
  | { type: "FEEDBACK_COLLECTED"; text: string }
  | { type: "STAGE_1_REACHED" }
  | { type: "PROSPECT_ARCHIVED" };
