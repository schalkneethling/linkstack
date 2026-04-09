// @ts-check
import { PUBLIC_SHARE_STATUS, REVIEW_DECISION } from "../constants/bookmark-model.js";
import {
  BOOKMARK_ACTION_LABELS,
  BOOKMARK_STATUS_LABELS,
} from "../constants/ui-strings.js";

export const PUBLICATION_REVIEW_KIND = Object.freeze({
  publicListing: "public_listing",
  publicStack: "public_stack",
  publicStackItem: "public_stack_item",
});

const PUBLICATION_EVENT = Object.freeze({
  submit: "submit",
  approve: "approve",
  reject: "reject",
  resubmit: "resubmit",
  attachApprovedReference: "attach_approved_reference",
});

const PUBLICATION_TRANSITIONS = Object.freeze({
  [PUBLIC_SHARE_STATUS.NOT_REQUESTED]: Object.freeze({
    [PUBLICATION_EVENT.submit]: PUBLIC_SHARE_STATUS.PENDING,
    [PUBLICATION_EVENT.attachApprovedReference]: PUBLIC_SHARE_STATUS.APPROVED,
  }),
  [PUBLIC_SHARE_STATUS.PENDING]: Object.freeze({
    [PUBLICATION_EVENT.approve]: PUBLIC_SHARE_STATUS.APPROVED,
    [PUBLICATION_EVENT.reject]: PUBLIC_SHARE_STATUS.REJECTED,
  }),
  [PUBLIC_SHARE_STATUS.APPROVED]: Object.freeze({
    [PUBLICATION_EVENT.submit]: PUBLIC_SHARE_STATUS.PENDING,
    [PUBLICATION_EVENT.resubmit]: PUBLIC_SHARE_STATUS.PENDING,
  }),
  [PUBLIC_SHARE_STATUS.REJECTED]: Object.freeze({
    [PUBLICATION_EVENT.submit]: PUBLIC_SHARE_STATUS.PENDING,
    [PUBLICATION_EVENT.resubmit]: PUBLIC_SHARE_STATUS.PENDING,
  }),
});

/**
 * @param {string} currentState
 * @param {string} event
 */
export function transitionPublicationState(currentState, event) {
  return PUBLICATION_TRANSITIONS[currentState]?.[event] || currentState;
}

/**
 * @param {{ isAdmin?: boolean, hasApprovedPublicListing?: boolean }} [context]
 */
export function getInitialStackItemState(context = {}) {
  if (context.isAdmin || context.hasApprovedPublicListing) {
    return transitionPublicationState(
      PUBLIC_SHARE_STATUS.NOT_REQUESTED,
      PUBLICATION_EVENT.attachApprovedReference,
    );
  }

  return transitionPublicationState(
    PUBLIC_SHARE_STATUS.NOT_REQUESTED,
    PUBLICATION_EVENT.submit,
  );
}

/**
 * @param {{ isAdmin?: boolean }} [context]
 */
export function getInitialSubmissionState(context = {}) {
  return context.isAdmin
    ? PUBLIC_SHARE_STATUS.APPROVED
    : transitionPublicationState(
        PUBLIC_SHARE_STATUS.NOT_REQUESTED,
        PUBLICATION_EVENT.submit,
      );
}

/**
 * @param {string} decision
 */
export function getReviewedState(decision) {
  return decision === REVIEW_DECISION.approve
    ? transitionPublicationState(
        PUBLIC_SHARE_STATUS.PENDING,
        PUBLICATION_EVENT.approve,
      )
    : transitionPublicationState(
        PUBLIC_SHARE_STATUS.PENDING,
        PUBLICATION_EVENT.reject,
      );
}

/**
 * @param {{ currentState: string, isOwner?: boolean }} input
 */
export function getStandalonePublicationAction(input) {
  const { currentState, isOwner = true } = input;

  if (currentState === PUBLIC_SHARE_STATUS.PENDING) {
    return { visible: false, label: "" };
  }

  if (currentState === PUBLIC_SHARE_STATUS.APPROVED && !isOwner) {
    return { visible: false, label: "" };
  }

  const labelByState = {
    [PUBLIC_SHARE_STATUS.NOT_REQUESTED]: BOOKMARK_ACTION_LABELS.requestPublicListing,
    [PUBLIC_SHARE_STATUS.REJECTED]: BOOKMARK_ACTION_LABELS.resubmitPublicListing,
    [PUBLIC_SHARE_STATUS.APPROVED]: BOOKMARK_ACTION_LABELS.updatePublicListing,
  };

  return {
    visible: true,
    label: labelByState[currentState] || BOOKMARK_ACTION_LABELS.requestPublicListing,
  };
}

/**
 * @param {{ currentState: string }} input
 */
export function getStackPublicationAction(input) {
  const { currentState } = input;

  if (currentState === PUBLIC_SHARE_STATUS.PENDING) {
    return { visible: false, label: "" };
  }

  const labelByState = {
    [PUBLIC_SHARE_STATUS.NOT_REQUESTED]: BOOKMARK_ACTION_LABELS.requestPublicStack,
    [PUBLIC_SHARE_STATUS.REJECTED]: BOOKMARK_ACTION_LABELS.resubmitPublicStack,
    [PUBLIC_SHARE_STATUS.APPROVED]: BOOKMARK_ACTION_LABELS.updatePublicStack,
  };

  return {
    visible: true,
    label: labelByState[currentState] || BOOKMARK_ACTION_LABELS.requestPublicStack,
  };
}

/**
 * @param {{ scope: "standalone" | "stack_root" | "stack_item", state: string, isOwner?: boolean, rejectionReason?: string }} input
 */
export function getPublicationBadge(input) {
  const {
    scope,
    state,
    isOwner = true,
    rejectionReason = "",
  } = input;

  if (!state || state === PUBLIC_SHARE_STATUS.NOT_REQUESTED) {
    return null;
  }

  if (scope === "stack_root") {
    const labelByState = {
      [PUBLIC_SHARE_STATUS.PENDING]: "Public stack pending",
      [PUBLIC_SHARE_STATUS.APPROVED]: "Public stack",
      [PUBLIC_SHARE_STATUS.REJECTED]: "Public stack rejected",
    };

    return {
      label: labelByState[state] || state,
      message: state === PUBLIC_SHARE_STATUS.REJECTED ? rejectionReason : "",
    };
  }

  if (scope === "stack_item") {
    const labelByState = {
      [PUBLIC_SHARE_STATUS.PENDING]: "Pending for stack",
      [PUBLIC_SHARE_STATUS.APPROVED]: "Public via stack",
      [PUBLIC_SHARE_STATUS.REJECTED]: "Stack item rejected",
    };

    return {
      label: labelByState[state] || state,
      message: state === PUBLIC_SHARE_STATUS.REJECTED ? rejectionReason : "",
    };
  }

  const labelByState = {
    [PUBLIC_SHARE_STATUS.PENDING]: BOOKMARK_STATUS_LABELS.pendingReview,
    [PUBLIC_SHARE_STATUS.APPROVED]: isOwner
      ? BOOKMARK_STATUS_LABELS.publiclyListed
      : BOOKMARK_STATUS_LABELS.alreadyPublic,
    [PUBLIC_SHARE_STATUS.REJECTED]: BOOKMARK_STATUS_LABELS.publicListingRejected,
  };

  return {
    label: labelByState[state] || state,
    message: state === PUBLIC_SHARE_STATUS.REJECTED ? rejectionReason : "",
  };
}

/**
 * @param {string} reviewKind
 */
export function getReviewTargetConfig(reviewKind) {
  const config = {
    [PUBLICATION_REVIEW_KIND.publicListing]: {
      table: "public_listings",
      reviewKind,
    },
    [PUBLICATION_REVIEW_KIND.publicStack]: {
      table: "public_stacks",
      reviewKind,
    },
    [PUBLICATION_REVIEW_KIND.publicStackItem]: {
      table: "public_stack_items",
      reviewKind,
    },
  }[reviewKind];

  if (!config) {
    throw new Error(`Unsupported review target: ${reviewKind}`);
  }

  return config;
}

