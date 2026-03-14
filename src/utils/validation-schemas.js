// @ts-check
import * as v from "valibot";

const HTTP_URL_MESSAGE = "URL must use http:// or https:// protocol";

const httpUrlSchema = v.pipe(
  v.string(),
  v.minLength(1, "URL is required"),
  v.url("Please enter a valid URL (must start with http:// or https://)"),
  v.check(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    HTTP_URL_MESSAGE,
  ),
);

const createBookmarkSchema = v.object({
  url: httpUrlSchema,
  page_title: v.string(),
  meta_description: v.optional(v.string()),
  notes: v.optional(v.string()),
  parent_id: v.optional(v.nullable(v.string())),
  request_public: v.optional(v.boolean()),
  tags: v.optional(v.array(v.string())),
});

const updateBookmarkSchema = v.object({
  page_title: v.optional(v.string()),
  meta_description: v.optional(v.string()),
  notes: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
});

const addExistingPublicBookmarkSchema = v.object({
  resourceId: v.string(),
  publicListingId: v.string(),
  notes: v.optional(v.string()),
  parentId: v.optional(v.nullable(v.string())),
});

const reviewDecisionSchema = v.picklist(["approve", "reject"]);

const reviewPublicShareSchema = v.pipe(
  v.object({
    decision: reviewDecisionSchema,
    rejectionCode: v.optional(v.nullable(v.string())),
    rejectionReason: v.optional(v.string()),
  }),
  v.check(
    (input) =>
      input.decision === "approve" || Boolean(input.rejectionCode?.trim()),
    "Choose a rejection reason before rejecting a bookmark.",
  ),
);

const bookmarkMetadataSchema = v.object({
  pageTitle: v.string(),
  metaDescription: v.string(),
});

const resourceRecordSchema = v.object({
  id: v.string(),
  normalized_url: v.string(),
  canonical_url: v.string(),
  page_title: v.string(),
  meta_description: v.string(),
});

const bookmarkRecordSchema = v.object({
  id: v.string(),
  user_id: v.string(),
  resource_id: v.string(),
  parent_id: v.nullable(v.string()),
  notes: v.string(),
  tags: v.array(v.string()),
  title_override: v.nullable(v.string()),
  description_override: v.nullable(v.string()),
  is_read: v.boolean(),
  read_at: v.nullable(v.string()),
  created_at: v.string(),
  updated_at: v.string(),
});

const publicListingRecordSchema = v.object({
  id: v.string(),
  resource_id: v.string(),
  submitted_by_user_id: v.string(),
  submitted_by_bookmark_id: v.string(),
  status: v.picklist(["not_requested", "pending", "approved", "rejected"]),
  page_title: v.string(),
  meta_description: v.string(),
  tags: v.array(v.string()),
  rejection_code: v.nullable(v.string()),
  rejection_reason: v.nullable(v.string()),
  reviewed_at: v.nullable(v.string()),
  reviewed_by: v.nullable(v.string()),
  created_at: v.string(),
  updated_at: v.string(),
});

const publicListingReferenceSchema = v.object({
  id: v.string(),
  resource_id: v.string(),
});

const bookmarkReferenceSchema = v.object({
  id: v.string(),
});

/**
 * @param {{ issues?: Array<{ message?: string }> } | undefined} result
 * @param {string} fallbackMessage
 */
export function getValidationMessage(result, fallbackMessage = "Invalid input") {
  return result?.issues?.[0]?.message || fallbackMessage;
}

/**
 * @param {string} url
 */
export function validateUrl(url) {
  return v.safeParse(httpUrlSchema, url);
}

/**
 * @param {unknown} input
 */
export function validateCreateBookmarkInput(input) {
  return v.safeParse(createBookmarkSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateUpdateBookmarkInput(input) {
  return v.safeParse(updateBookmarkSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateAddExistingPublicBookmarkInput(input) {
  return v.safeParse(addExistingPublicBookmarkSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateReviewPublicShareInput(input) {
  return v.safeParse(reviewPublicShareSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateBookmarkMetadata(input) {
  return v.safeParse(bookmarkMetadataSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateResourceRecord(input) {
  return v.safeParse(resourceRecordSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateResourceRecords(input) {
  return v.safeParse(v.array(resourceRecordSchema), input);
}

/**
 * @param {unknown} input
 */
export function validateBookmarkRecord(input) {
  return v.safeParse(bookmarkRecordSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateBookmarkRecords(input) {
  return v.safeParse(v.array(bookmarkRecordSchema), input);
}

/**
 * @param {unknown} input
 */
export function validatePublicListingRecord(input) {
  return v.safeParse(publicListingRecordSchema, input);
}

/**
 * @param {unknown} input
 */
export function validatePublicListingRecords(input) {
  return v.safeParse(v.array(publicListingRecordSchema), input);
}

/**
 * @param {unknown} input
 */
export function validatePublicListingReference(input) {
  return v.safeParse(publicListingReferenceSchema, input);
}

/**
 * @param {unknown} input
 */
export function validateBookmarkReference(input) {
  return v.safeParse(bookmarkReferenceSchema, input);
}
