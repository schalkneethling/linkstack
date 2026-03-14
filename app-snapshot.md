# LinkStack UI Snapshot

This file intentionally captures only the stable, high-value structure of the app shell.

## App Shell

- Header with:
  - brand
  - guest sign-in or authenticated profile menu
  - authenticated-only `New` button
  - admin-only moderation toggle
- Main content with:
  - admin review panel
  - search
  - view toggle
  - scope switcher
  - optional read filters in personal scope
  - sort control
  - bookmark list

## Bookmark Rendering Modes

- Guest/public mode:
  - approved public catalog only
  - no private notes or read state
- Personal mode:
  - full owner bookmark cards
  - stacks, notes, read status, edit/delete actions
  - public submission status surfaced on the card
- Mixed mode:
  - personal bookmarks plus approved public bookmarks not already saved privately
  - public cards offer `Save to My Bookmarks`

## Moderation

- Pending public submissions render in a dedicated admin review panel.
- Review actions are approve or reject.
- Rejections may include a code and optional reviewer note.
