/**
 * Zod Validation Schemas for LinkStack
 *
 * Provides client-side validation for bookmark data to ensure
 * data integrity before network calls and provide helpful user feedback.
 */

import { z } from "zod";

/**
 * Bookmark validation schema
 *
 * Validates:
 * - URL must be a valid HTTP/HTTPS URL
 * - Notes are optional and can be any string
 */
export const bookmarkSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Please enter a valid URL (must start with http:// or https://)"),
  notes: z.string().optional(),
});

/**
 * Validate a bookmark object
 * @param {Object} data - The bookmark data to validate
 * @returns {Object} - { success: boolean, error?: ZodError, data?: ValidatedData }
 */
export function validateBookmark(data) {
  return bookmarkSchema.safeParse(data);
}

/**
 * Validate just the URL field
 * @param {string} url - The URL to validate
 * @returns {Object} - { success: boolean, error?: ZodError }
 */
export function validateUrl(url) {
  const urlSchema = z
    .string()
    .min(1, "URL is required")
    .url("Please enter a valid URL (must start with http:// or https://)");

  return urlSchema.safeParse(url);
}
