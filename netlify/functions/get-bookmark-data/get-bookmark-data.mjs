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

    const pageTitle = $("head > title").text();
    const metaDescription = $('meta[name="description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const twitterImg = $('meta[name="twitter:image"]').attr("content");
    const previewImg = ogImage || twitterImg;

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
