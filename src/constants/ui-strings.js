// @ts-check

export const BOOKMARK_ACTION_LABELS = Object.freeze({
  markAsRead: "Mark as Read",
  markAsUnread: "Mark as Unread",
  saveToMyBookmarks: "Save to My Bookmarks",
  requestPublicListing: "Request Public Listing",
  updatePublicListing: "Update Public Listing",
  resubmitPublicListing: "Resubmit Public Listing",
  bookmarkSubmittedForReview: "Bookmark submitted for public review",
});

export const BOOKMARK_STATUS_LABELS = Object.freeze({
  pendingReview: "Pending review",
  publiclyListed: "Publicly listed",
  alreadyPublic: "Already public",
  publicListingRejected: "Public listing rejected",
});

export const BOOKMARK_UI_MESSAGES = Object.freeze({
  noApprovedPublicBookmarks: "No public bookmarks have been approved yet.",
  noBookmarksPrompt: "Why not add your first?",
  loadBookmarksFailed: "Failed to load bookmarks. Please try refreshing the page.",
  deleteFailed: "Failed to delete bookmark. Please try again.",
  readStatusFailed: "Failed to update read status. Please try again.",
  saveBookmarkFailed: "Failed to save bookmark.",
  submitForReviewFailed: "Failed to submit bookmark for review.",
});

export const MODERATION_UI_MESSAGES = Object.freeze({
  chooseRejectionReason: "Choose a rejection reason before rejecting this bookmark.",
  bookmarkApproved: "Bookmark approved for the public catalog.",
  publicListingRejected: "Public listing rejected.",
  reviewFailed: "Failed to review bookmark.",
  noBookmarksWaiting: "No bookmarks are waiting for review.",
  moderationQueueFailed: "Failed to load moderation queue.",
});

export const FORM_UI_MESSAGES = Object.freeze({
  loadStackOptionsFailed: "Failed to load stack options. Please try again.",
  duplicateUrl: "This URL has already been bookmarked. Please enter a different URL.",
  bookmarkAdded: "Bookmark added successfully!",
  bookmarkAddedWithReview: "Bookmark added and submitted for public review.",
  metadataUnavailable: "Bookmark saved (metadata unavailable for this site)",
  addBookmarkFailed: "Failed to add bookmark. Please try again.",
  duplicatePublicTitle: "Link already public",
  duplicatePublicPrompt: "This link is already public. Add it to your private bookmarks instead?",
  duplicatePublicConfirmAction: "Add to my bookmarks",
  duplicatePublicCancelAction: "Skip",
  addedPrivateInstead: "This link is already public. It was added to your private bookmarks instead.",
  addedPrivateBookmark: "Bookmark added to your private bookmarks.",
  publicTopLevelOnly: "Only top-level bookmarks can be submitted to the public catalog.",
  publicRequiresApproval:
    "Public submissions remain private in your library and require moderator approval before they appear publicly.",
});

export const CONFIRM_DIALOG_MESSAGES = Object.freeze({
  confirm: "Confirm",
  cancel: "Cancel",
});

export const EDIT_DIALOG_MESSAGES = Object.freeze({
  updateSuccess: "Bookmark updated successfully!",
  loadFailed: "Failed to load bookmark. Please try again.",
  saveFailed: "Failed to save changes. Please try again.",
});
