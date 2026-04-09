// @ts-check

export const STACK_DELETION_STATE = Object.freeze({
  idle: "idle",
  choosingStrategy: "choosing_strategy",
  choosingChild: "choosing_child",
  applying: "applying",
  done: "done",
  cancelled: "cancelled",
});

export const STACK_DELETION_EVENT = Object.freeze({
  begin: "begin",
  selectStrategy: "select_strategy",
  selectChild: "select_child",
  apply: "apply",
  cancel: "cancel",
  complete: "complete",
});

const STACK_DELETION_TRANSITIONS = Object.freeze({
  [STACK_DELETION_STATE.idle]: Object.freeze({
    [STACK_DELETION_EVENT.begin]: STACK_DELETION_STATE.choosingStrategy,
  }),
  [STACK_DELETION_STATE.choosingStrategy]: Object.freeze({
    [STACK_DELETION_EVENT.selectStrategy]: STACK_DELETION_STATE.applying,
    [STACK_DELETION_EVENT.cancel]: STACK_DELETION_STATE.cancelled,
  }),
  [STACK_DELETION_STATE.choosingChild]: Object.freeze({
    [STACK_DELETION_EVENT.selectChild]: STACK_DELETION_STATE.applying,
    [STACK_DELETION_EVENT.cancel]: STACK_DELETION_STATE.cancelled,
  }),
  [STACK_DELETION_STATE.applying]: Object.freeze({
    [STACK_DELETION_EVENT.complete]: STACK_DELETION_STATE.done,
  }),
});

/**
 * @param {string} currentState
 * @param {string} event
 * @param {{ strategy?: string }} [context]
 */
export function transitionStackDeletionState(currentState, event, context = {}) {
  if (
    currentState === STACK_DELETION_STATE.choosingStrategy &&
    event === STACK_DELETION_EVENT.selectStrategy &&
    context.strategy === "promote_child"
  ) {
    return STACK_DELETION_STATE.choosingChild;
  }

  return STACK_DELETION_TRANSITIONS[currentState]?.[event] || currentState;
}

