# LinkStack Project Notes

## What Matters

LinkStack is a reading-list style bookmark manager built with vanilla JavaScript and Web Components.
Users save links to the original source, manage their private library, and optionally submit links for inclusion in a moderated public catalog.

## Current Architecture

- Frontend: vanilla JS ES modules, Web Components, semantic HTML, custom CSS
- Backend: Supabase for auth and data
- Metadata extraction: Netlify function using Cheerio
- Build/dev: Vite

## Current Data Model

The current app is built around normalized shared resources:

- `resources`: canonical link identity and shared fetched metadata
- `bookmarks`: a user's saved relationship to a resource plus private state
- `public_listings`: moderated public catalog records for resources
- `user_roles`: app roles such as `admin`

Do not assume the old localStorage or single-table bookmark model is still relevant.

## Product Rules

- Guests can browse approved public bookmarks.
- Signed-in users can switch between `My bookmarks` and `All bookmarks`.
- A bookmark is added to the owner’s library immediately.
- Public sharing is a separate moderation workflow.
- If a link is already public, users may still save it privately, but should not create a duplicate public entry.
- Only top-level bookmarks can be submitted for public review.
- Private state such as notes and read status must never leak into the public catalog.

## Important Source Areas

- `src/app.js`: app shell orchestration and auth-state-driven UI
- `src/services/bookmarks.service.js`: resource/bookmark/public-listing access and feed composition
- `src/linkstack-bookmarks-supabase.js`: bookmark list rendering and interactions
- `src/linkstack-form-supabase.js`: add flow, duplicate handling, and public submission
- `src/linkstack-public-reviews.js`: admin moderation UI
- `supabase/schema.sql`: schema and RLS contract

## Working Expectations

- Prefer consistency over novelty.
- Follow existing Web Component patterns unless there is a strong reason to change them.
- Favor semantic HTML, keyboard accessibility, and clear focus management.
- Keep public and private concerns separated in both data access and UI behavior.
- Keep this file short, current, and high-signal.
