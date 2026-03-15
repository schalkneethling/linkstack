# LinkStack Project Guide

## What LinkStack is

LinkStack is a reading-list style bookmark manager built with vanilla JavaScript and Web Components.
Users save links to the original source, organize their library, and optionally submit bookmarks for inclusion in a moderated public catalog.

## Current Architecture

- Frontend: vanilla JS ES modules, Web Components, semantic HTML, custom CSS
- Backend: Supabase for auth and data
- Metadata extraction: Netlify function using Cheerio
- Build/dev: Vite

## Current Data Model

The app now uses a normalized model:

- `resources`: canonical link identity and shared fetched metadata
- `bookmarks`: a user's saved relationship to a resource and their private state
- `public_listings`: moderated public catalog entries for resources
- `user_roles`: application roles such as `admin`

Do not assume the old single-table bookmark model or localStorage-based persistence is still relevant.

## Product Rules That Matter

- Guests can browse approved public bookmarks.
- Signed-in users can switch between `My bookmarks` and `All bookmarks`.
- A bookmark always exists in the owner's personal library immediately.
- Public sharing is a separate moderation workflow.
- If a link already exists in the public catalog, users may still save it privately, but should not create a second public entry.
- Only top-level bookmarks are eligible for public sharing.
- Private state such as notes and read status must never leak into the public catalog.

## Important Source Areas

- `src/app.js`: app shell orchestration and auth-state-driven UI
- `src/services/bookmarks.service.js`: resource/bookmark/public-listing data access and feed composition
- `src/linkstack-bookmarks-supabase.js`: list rendering for guest, personal, and mixed feeds
- `src/linkstack-form-supabase.js`: add flow, duplicate handling, and public submission flow
- `src/linkstack-public-reviews.js`: admin moderation UI
- `supabase/schema.sql`: current schema and RLS contract

## Working Expectations

- Prefer consistency over novelty.
- Follow existing Web Component patterns unless there is a strong reason to replace them.
- Favor semantic HTML, keyboard accessibility, and clear focus management.
- Keep public and private concerns separated in both data access and UI rendering.
- Treat generated or build output as disposable; do not document it as source structure.
- Keep this file high-signal and durable. If a detail is obvious from code or likely to drift quickly, leave it out.
