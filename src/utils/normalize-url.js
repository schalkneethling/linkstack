// -check
/**
 * Normalize a URL for duplicate detection.
 * Keeps the origin and path stable while dropping fragments and empty defaults.
 *
 * @param {string} input
 * @returns {string}
 */
export function normalizeUrl(input) {
  const parsed = new URL(input);

  parsed.hash = "";
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  parsed.searchParams.sort();

  return parsed.toString();
}
