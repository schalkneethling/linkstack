// @ts-check

/** @typedef {(typeof BOOKMARK_SCOPE)[keyof typeof BOOKMARK_SCOPE]} BookmarkScope */
/** @typedef {(typeof BOOKMARK_SORT)[keyof typeof BOOKMARK_SORT]} BookmarkSort */
/** @typedef {(typeof BOOKMARK_FILTER)[keyof typeof BOOKMARK_FILTER]} BookmarkFilter */
/** @typedef {(typeof VIEW_MODE)[keyof typeof VIEW_MODE]} ViewMode */

export const BOOKMARK_SCOPE = Object.freeze({
  public: "public",
  mine: "mine",
  all: "all",
});

export const BOOKMARK_SORT = Object.freeze({
  newest: "newest",
  oldest: "oldest",
  alphaAsc: "alpha-asc",
  alphaDesc: "alpha-desc",
});

export const BOOKMARK_FILTER = Object.freeze({
  all: "all",
  read: "read",
  unread: "unread",
});

export const VIEW_MODE = Object.freeze({
  grid: "grid",
  list: "list",
});
