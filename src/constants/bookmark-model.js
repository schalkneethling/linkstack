// @ts-check

/** @typedef {(typeof PUBLIC_SHARE_STATUS)[keyof typeof PUBLIC_SHARE_STATUS]} PublicShareStatus */
/** @typedef {(typeof BOOKMARK_KIND)[keyof typeof BOOKMARK_KIND]} BookmarkKind */
/** @typedef {(typeof BOOKMARK_OWNERSHIP)[keyof typeof BOOKMARK_OWNERSHIP]} BookmarkOwnership */
/** @typedef {(typeof REVIEW_DECISION)[keyof typeof REVIEW_DECISION]} ReviewDecision */

export const PUBLIC_SHARE_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const BOOKMARK_KIND = Object.freeze({
  bookmark: "bookmark",
  public: "public",
});

export const BOOKMARK_OWNERSHIP = Object.freeze({
  mine: "mine",
  public: "public",
});

export const REVIEW_DECISION = Object.freeze({
  approve: "approve",
  reject: "reject",
});
