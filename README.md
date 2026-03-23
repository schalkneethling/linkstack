# LinkStack

[![Netlify Status](https://api.netlify.com/api/v1/badges/4227e1ca-9864-497d-b07b-7b8f66b2d5ee/deploy-status)](https://app.netlify.com/projects/linkstack/deploys)

LinkStack is a bookmark manager for saving links to the original source,
organizing a personal reading library, and optionally sharing standout links
through a moderated public catalog.

## Beta Status

LinkStack is currently in beta.

The current beta includes:

- personal bookmarks and reading-state tracking
- guest browsing of approved public bookmarks
- Google and GitHub sign-in
- public submissions with moderation
- admin moderation tools

## Known Beta Limitations

- Metadata extraction depends on third-party sites and may fail, be incomplete,
  or return slower than expected for some URLs.
- Some sites may block server-side metadata fetching entirely.
- The public catalog and moderation flow are functional, but still relatively
  new and worth close observation under broader use.
- UI polish and messaging are improving, and small rough edges may still
  surface during normal use.

## Feedback

GitHub Issues are the main feedback channel during beta:

- open a bug report if something is broken or misleading
- include the bookmarked URL when reporting metadata issues
- include whether you signed in with Google or GitHub for auth-related issues
- include screenshots when the issue is visual or interaction-based

Project:

- [GitHub repository](https://github.com/schalkneethling/linkstack)

App:

- [LinkStack beta](https://linkstack.netlify.app)
