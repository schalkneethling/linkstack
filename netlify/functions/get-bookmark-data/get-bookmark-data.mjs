import * as cheerio from "cheerio";

// CORS configuration - restrict to known origins
const getAllowedOrigin = (requestOrigin) => {
  const allowedOrigins = [
    "http://localhost:8888",
    "http://localhost:3000",
    "https://linkstack.netlify.app", // Add your production domain
  ];

  return allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];
};

// Docs on request and context https://docs.netlify.com/functions/build/#code-your-function-2
export default async (request) => {
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
      return new Response(
        JSON.stringify({ error: "URL parameter is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    const response = await fetch(bookmark);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch URL" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
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

    // Extract preview image with fallback
    const ogImage = cleanText($('meta[property="og:image"]').attr("content"));
    const twitterImg = cleanText(
      $('meta[name="twitter:image"]').attr("content"),
    );
    const previewImg = ogImage || twitterImg || "";

    const jsonResponse = JSON.stringify({
      pageTitle,
      metaDescription,
      previewImg,
    });

    return new Response(jsonResponse, {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
};
