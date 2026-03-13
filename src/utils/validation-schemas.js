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
  preview_img: v.optional(v.string()),
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
