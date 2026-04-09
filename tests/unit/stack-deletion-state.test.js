// @ts-check
import { describe, expect, it } from "vitest";
import {
  STACK_DELETION_EVENT,
  STACK_DELETION_STATE,
  transitionStackDeletionState,
} from "../../src/domain/stack-deletion-state.js";

describe("stack deletion state machine", () => {
  it("moves from idle into strategy selection", () => {
    expect(
      transitionStackDeletionState(
        STACK_DELETION_STATE.idle,
        STACK_DELETION_EVENT.begin,
      ),
    ).toBe(STACK_DELETION_STATE.choosingStrategy);
  });

  it("routes promote-child through child selection", () => {
    const next = transitionStackDeletionState(
      STACK_DELETION_STATE.choosingStrategy,
      STACK_DELETION_EVENT.selectStrategy,
      { strategy: "promote_child" },
    );

    expect(next).toBe(STACK_DELETION_STATE.choosingChild);
  });

  it("routes other strategies directly to applying", () => {
    const next = transitionStackDeletionState(
      STACK_DELETION_STATE.choosingStrategy,
      STACK_DELETION_EVENT.selectStrategy,
      { strategy: "unstack_children" },
    );

    expect(next).toBe(STACK_DELETION_STATE.applying);
  });

  it("can be cancelled from interactive states", () => {
    expect(
      transitionStackDeletionState(
        STACK_DELETION_STATE.choosingChild,
        STACK_DELETION_EVENT.cancel,
      ),
    ).toBe(STACK_DELETION_STATE.cancelled);
  });
});
