// @ts-check
import { describe, expect, it } from "vitest";
import { PUBLIC_SHARE_STATUS } from "../../src/constants/bookmark-model.js";
import {
  getInitialStackItemState,
  getInitialSubmissionState,
  getPublicationBadge,
  getReviewTargetConfig,
  getReviewedState,
  getStackPublicationAction,
  getStandalonePublicationAction,
  PUBLICATION_REVIEW_KIND,
  transitionPublicationState,
} from "../../src/domain/publication-state.js";

describe("publication state machine", () => {
  it("transitions a new submission into pending by default", () => {
    expect(getInitialSubmissionState()).toBe(PUBLIC_SHARE_STATUS.PENDING);
    expect(
      transitionPublicationState(
        PUBLIC_SHARE_STATUS.NOT_REQUESTED,
        "submit",
      ),
    ).toBe(PUBLIC_SHARE_STATUS.PENDING);
  });

  it("approves stack items immediately when backed by an approved public listing", () => {
    expect(
      getInitialStackItemState({ hasApprovedPublicListing: true }),
    ).toBe(PUBLIC_SHARE_STATUS.APPROVED);
  });

  it("derives review outcomes from moderation decisions", () => {
    expect(getReviewedState("approve")).toBe(PUBLIC_SHARE_STATUS.APPROVED);
    expect(getReviewedState("reject")).toBe(PUBLIC_SHARE_STATUS.REJECTED);
  });

  it("derives standalone and stack actions from explicit states", () => {
    expect(
      getStandalonePublicationAction({
        currentState: PUBLIC_SHARE_STATUS.NOT_REQUESTED,
        isOwner: true,
      }),
    ).toEqual({
      visible: true,
      label: "Request Public Listing",
    });
    expect(
      getStackPublicationAction({
        currentState: PUBLIC_SHARE_STATUS.REJECTED,
      }),
    ).toEqual({
      visible: true,
      label: "Resubmit Public Stack",
    });
  });

  it("derives badges from state rather than branching inline", () => {
    expect(
      getPublicationBadge({
        scope: "stack_item",
        state: PUBLIC_SHARE_STATUS.APPROVED,
      }),
    ).toEqual({
      label: "Public via stack",
      message: "",
    });
  });

  it("maps review kinds to review targets", () => {
    expect(getReviewTargetConfig(PUBLICATION_REVIEW_KIND.publicStack)).toEqual({
      table: "public_stacks",
      reviewKind: "public_stack",
    });
  });
});
