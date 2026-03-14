// @ts-check
import * as cheerio from "cheerio";
import {
  captureServerException,
  initServerMonitoring,
} from "../_shared/monitoring.js";
import {
  getValidationMessage,
  validateBookmarkMetadata,
  validateUrl,
} from "../../../src/utils/validation-schemas.js";

const JSON_HEADERS = {
  "content-type": "application/json",
};

const REQUEST_HEADERS = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
});

// CORS configuration - restrict to known origins
const getAllowedOrigin = (requestOrigin) => {
  const allowedOrigins = [
    "http://localhost:8888",
    "http://localhost:3000",
    "https://linkstacks.netlify.app", // Add your production domain
  ];

  return allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];
};

const createJsonResponse = (payload, corsHeaders, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, ...JSON_HEADERS },
  });

const sanitizeMetadata = (input, fallbackTitle) => {
  const validationResult = validateBookmarkMetadata(input);

  if (validationResult.success) {
    return validationResult.output;
  }

  return {
    pageTitle: fallbackTitle,
    metaDescription: "",
  };
};

// Docs on request and context https://docs.netlify.com/functions/build/#code-your-function-2
export default async (request) => {
  initServerMonitoring();

  const origin = request.headers.get("origin") || "http://localhost:8888";
  const corsHeaders = {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(request.url);
    const bookmark = url.searchParams.get("url");

    if (!bookmark) {
      return createJsonResponse(
        { error: "URL parameter is required" },
        corsHeaders,
        400,
      );
    }

    const validationResult = validateUrl(bookmark);
    if (!validationResult.success) {
      return createJsonResponse(
        {
          error: getValidationMessage(
            validationResult,
            "Please enter a valid URL.",
          ),
        },
        corsHeaders,
        400,
      );
    }

    const response = await fetch(bookmark, {
      headers: REQUEST_HEADERS,
    });

    if (!response.ok) {
      return createJsonResponse(
        {
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        },
        corsHeaders,
        500,
      );
    }

    const responseTxt = await response.text();
    const $ = cheerio.load(responseTxt);

    // Helper to clean and validate text
    const cleanText = (text) => (text || "").trim();

    // Extract title with robust fallback chain
    const ogTitle = cleanText($('meta[property="og:title"]').attr("content"));
    const twitterTitle = cleanText(
      $('meta[name="twitter:title"]').attr("content"),
    );
    const htmlTitleInHead = cleanText($("head > title").text());
    const htmlTitleInBody = cleanText($("body > title").text()); // Edge case: invalid HTML
    const htmlTitleAnywhere = cleanText($("title").text());

    // Fallback chain: og:title → twitter:title → <title> in head → <title> in body → <title> anywhere → URL
    const pageTitle =
      ogTitle ||
      twitterTitle ||
      htmlTitleInHead ||
      htmlTitleInBody ||
      htmlTitleAnywhere ||
      bookmark;

    // Extract description with fallback chain
    const ogDescription = cleanText(
      $('meta[property="og:description"]').attr("content"),
    );
    const twitterDescription = cleanText(
      $('meta[name="twitter:description"]').attr("content"),
    );
    const htmlDescription = cleanText(
      $('meta[name="description"]').attr("content"),
    );
    const metaDescription =
      ogDescription || twitterDescription || htmlDescription || "";

    const metadata = sanitizeMetadata({
      pageTitle,
      metaDescription,
    }, bookmark);

    return createJsonResponse(metadata, corsHeaders);
  } catch (error) {
    await captureServerException(error, {
      functionName: "get-bookmark-data",
      requestUrl: request.url,
      method: request.method,
    });

    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? `Error processing URL: ${error.message}`
            : "Error processing URL.",
      },
      corsHeaders,
      500,
    );
  }
};
