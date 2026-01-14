# LinkStack - Project Guide for Claude

## Project Overview

LinkStack is a bookmark manager web application designed to serve as a **reading list tool** for saving and managing links to articles, blog posts, and web content. The application uses vanilla JavaScript with Web Components and localStorage for data persistence, with a Netlify serverless function for metadata extraction.

### Project Goal

Transform LinkStack into a complete reading list management tool where users can:
- Save articles and web content for later reading
- Organize and categorize saved content
- Track reading progress and status
- Search and filter their reading list
- Manage their reading workflow efficiently

**Important Design Principles:**
- **Deliberately Simple**: LinkStack is a link manager, not a reader app
- **External Reading**: Bookmarks always link to the original source
- **No Built-in Reader**: Users read articles on the original websites
- **Focus on Organization**: Emphasis on categorization, search, and workflow
- **Database-First**: Supabase as the single source of truth (no offline-first complexity)
- **Always Online**: Assumes internet connectivity (needed to access linked content anyway)

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Architecture**: Web Components (Custom Elements)
- **Backend**: Supabase (Postgres database + Auth + Storage)
- **Serverless Functions**: Netlify functions (for metadata extraction)
- **Current Storage**: localStorage (temporary - will migrate to Supabase)
- **Authentication**: Supabase Auth (supports Google, GitHub, GitLab, email, etc.)
- **Styling**: Custom CSS with a minimalist design system
- **Metadata Extraction**: Cheerio (server-side HTML parsing in Netlify function)
- **Dev Tools**: ESLint, Prettier, Stylelint

## Project Structure

```
linkstack/
├── src/
│   ├── linkstack-bookmarks.js      # Main bookmarks display component
│   ├── linkstack-form.js           # Form for adding bookmarks
│   └── linkstack-edit-dialog.js    # Dialog for editing bookmarks
├── css/
│   ├── linkstack.css               # Main styles
│   ├── minimalist/                 # Design system styles
│   └── components/                 # Component-specific styles
├── netlify/
│   └── functions/
│       └── get-bookmark-data/      # Serverless function for metadata extraction
├── index.html                      # Main application entry point
└── package.json
```

## Key Components

### 1. `linkstack-bookmarks` (src/linkstack-bookmarks.js:1)

Main component that manages bookmark display and interactions.

**Key Features:**
- Renders bookmarks from localStorage
- Handles bookmark deletion
- Triggers edit dialog via custom events
- Listens for storage events for cross-tab updates
- Shows "no bookmarks" state when empty

**Storage Key:** `bookmarks:linkstack`

**Bookmark Object Structure:**
```javascript
{
  id: string,              // UUID generated with crypto.randomUUID()
  url: string,             // Original bookmark URL
  pageTitle: string,       // Extracted from <title> or Open Graph
  metaDescription: string, // Extracted from meta description
  previewImg: string,      // OG image, Twitter image, or fallback
  createdAt: string,       // ISO 8601 timestamp
  updatedAt: string        // ISO 8601 timestamp (when edited)
}
```

**Metadata Extraction Process (Current - localStorage):**
1. User submits URL via form
2. Frontend calls Netlify function `/netlify/functions/get-bookmark-data`
3. Function fetches HTML using Cheerio
4. Extracts: page title, meta description, preview image (OG/Twitter)
5. Returns JSON to frontend
6. Frontend adds ID, timestamps, and stores in localStorage

**Future Process (with Supabase):**
1. User submits URL via form
2. Frontend calls Netlify function for metadata extraction
3. Function fetches HTML using Cheerio, extracts metadata
4. Function returns metadata to frontend
5. Frontend saves bookmark to Supabase (with user ID from auth session)
6. Frontend updates UI with new bookmark from database response

Note: Alternatively, could save directly to Supabase from Netlify function if needed.

### 2. `linkstack-form` (src/linkstack-form.js)

Form component for adding new bookmarks.

### 3. `linkstack-edit-dialog` (src/linkstack-edit-dialog.js)

Dialog component for editing bookmark title and description.

**Features:**
- Listens for custom `edit-bookmark` events
- Updates bookmark data in localStorage
- Sets `updatedAt` timestamp on save
- Communicates with `linkstack-bookmarks` to update UI

## Development Commands

```bash
npm run prettier:lint      # Check code formatting
npm run prettier:format    # Auto-format code
npm run lint:js           # Lint JavaScript files
npm run lint:css          # Lint CSS files
```

## Code Style & Conventions

### JavaScript
- ES6 modules with explicit imports/exports
- Web Components using Custom Elements API
- Private fields/methods using `#` prefix
- Static selectors defined as `#selectors`
- Error handling with descriptive messages
- Event delegation for dynamic content

### CSS
- Component-scoped stylesheets
- Minimalist design system
- BEM-like naming conventions
- Utility classes (`.visually-hidden`, `.reset-list`)

### HTML
- Semantic HTML5
- Accessibility-first (ARIA labels, proper heading hierarchy)
- Template elements for dynamic content
- Descriptive IDs and class names

## Architecture Patterns

1. **Web Components**: Each major UI section is a custom element
2. **Event-Driven**: Components communicate via custom events
3. **localStorage**: Client-side data persistence
4. **Template Cloning**: HTML templates for dynamic bookmark entries
5. **Private Encapsulation**: Private class fields for internal state

## Recent Changes

Based on recent commits:
- **Edit Bookmark Feature**: Users can now edit bookmark titles and descriptions (PR #35)
- **updatedAt Timestamp**: Bookmarks track when they were last edited (commit 2015d65)
- **Stylelint Update**: Updated to stylelint 16.14.1 (PR #33)

## Working with This Project

### Adding New Features
- Follow the Web Component pattern
- Create component JS file in `src/`
- Create corresponding CSS in `css/components/`
- Add to `index.html` with proper script module import
- Ensure accessibility compliance

### Modifying Bookmarks
- All bookmark CRUD operations go through localStorage
- Storage key: `bookmarks:linkstack`
- Dispatch storage events for cross-tab sync
- Update `updatedAt` field when modifying existing bookmarks

### Styling
- Component styles go in `css/components/`
- Use existing design system tokens from `css/minimalist/`
- Run `npm run lint:css` before committing

### Testing Locally
- Serve `index.html` with a local web server
- Check browser console for errors
- Test localStorage persistence
- Verify cross-tab synchronization

## Important Notes

- No build process required (vanilla JS)
- All state stored in localStorage (no backend)
- Cheerio dependency suggests server-side metadata extraction capability
- Responsive design with mobile viewport meta tag
- External links open in new tabs with security attributes

## Git Workflow

- Main branch: `main`
- Current worktree: `vigorous-sammet`
- Use conventional commit messages
- Run linters before committing
- Create PRs for feature branches

---

## Current State vs Reading List Tool Requirements

### ✅ What's Currently Implemented

**Core CRUD Operations:**
- ✅ Add bookmarks via URL submission with automatic metadata extraction
- ✅ Edit bookmark title and description
- ✅ Delete bookmarks with immediate UI updates
- ✅ View bookmarks in responsive grid layout

**Metadata Capabilities:**
- ✅ Automatic extraction of page title, description, and preview images
- ✅ Timestamp tracking (created/updated)
- ✅ Fallback handling for missing preview images
- ✅ Cross-tab synchronization via storage events

**UI/UX:**
- ✅ Clean, responsive grid layout
- ✅ Empty state messaging
- ✅ Modal edit dialog
- ✅ Accessibility-focused (ARIA labels, semantic HTML)

### ❌ Critical Gaps for Reading List Use Case

**1. Reading Status & Progress Tracking**
- ❌ No read/unread status
- ❌ No "to-read" vs "read" distinction
- ❌ No progress tracking or reading timestamps
- ❌ No priority/importance marking

**2. Organization & Categorization**
- ❌ No tags or labels system
- ❌ No categories or folders
- ❌ No custom collections
- ❌ All bookmarks in single flat list

**3. Search & Discovery**
- ❌ No search functionality (by title, URL, or description)
- ❌ No filtering capabilities
- ❌ No advanced search with multiple criteria

**4. Sorting & Display Options**
- ❌ Fixed reverse-chronological order only
- ❌ No user-controllable sorting (by title, date, status)
- ❌ No list view alternative to grid
- ❌ No compact/detailed view toggle

**5. Data Management**
- ❌ No export functionality (JSON, HTML, CSV)
- ❌ No import from other bookmark managers
- ❌ No multi-device support (currently localStorage only)
- ❌ Limited by browser localStorage constraints (~5-10MB)
- ❌ No user authentication or accounts

**6. Enhanced Reading Features**
- ❌ No simple notes field on bookmarks
- ❌ No archive or "read later" queue
- ⚠️ No built-in reader (out of scope - external links only)
- ⚠️ No highlights support (out of scope)
- ⚠️ No reading time estimation (not priority)

**7. Batch Operations**
- ❌ No multi-select for bulk actions
- ❌ No batch delete or bulk tagging
- ❌ No undo/redo for deletions

**8. Advanced Metadata**
- ❌ No author information capture
- ❌ No source/domain grouping
- ❌ No article publication date
- ❌ No content length/word count

### 🎯 Recommended Implementation Roadmap

**Phase 1: Supabase Database Migration**
1. **Set up Supabase project**
   - Create Supabase account and project
   - Set up database schema with Row Level Security (RLS)
   - Configure authentication providers (Google, GitHub, etc.)
   - Install Supabase JavaScript client
2. **Implement authentication**
   - Add login/signup UI components
   - Integrate social login (Google, GitHub)
   - Handle auth state management
   - Add logout functionality
3. **Migrate from localStorage to Supabase**
   - Replace localStorage calls with Supabase client queries
   - Implement RLS policies for user data isolation
   - Update components to work with async database calls
   - Migration script for existing localStorage data (optional)
4. Test and verify all existing features work with Supabase

**Phase 2: Essential Reading List Features**
1. Read/unread toggle for each bookmark
2. Basic search by title and description
3. Sort options (newest, oldest, alphabetical)
4. Tag system with basic filtering
5. List view option alongside grid view
6. Multi-tag support with tag management
7. Advanced filtering (by tags, date ranges, read status)
8. Priority/star marking for important items
9. Quick filters (unread, starred, recent)

**Phase 3: Data & Workflow**
1. Export bookmarks (JSON, HTML formats)
2. Import from other services
3. Bulk operations (multi-select, batch actions)
4. Simple notes on bookmarks (optional short text field)
5. Archive feature for completed reads

**Phase 4: Polish & Extensions**
1. Browser extension for quick bookmark capture
2. Basic statistics (total bookmarks, unread count, etc.)
3. Duplicate detection and management
4. Keyboard shortcuts for power users

### 💡 Key Design Considerations

**Simplicity First:**
- LinkStack is NOT a reader app - it's a bookmark organizer
- No built-in article readers, text extraction, or reading modes
- All bookmarks link to external sources
- Focus on making it easy to save, organize, and find links

**Database-First Architecture:**
- **Current**: localStorage only (~5-10MB limit, single device)
- **Target**: Supabase as single source of truth
  - No offline-first complexity or sync logic
  - Direct database reads/writes using Supabase client
  - Multi-device support through Supabase Auth
  - Simpler codebase without dual storage systems
  - Row Level Security (RLS) for automatic user data isolation
- **Rationale**: Users need internet to read links anyway, so offline access to the list provides minimal value

**Performance:**
- Supabase Postgres database with good performance
- Current implementation is fast for small collections
- May need pagination/virtualization for 500+ bookmarks
- Search/filter will leverage Postgres full-text search
- Supabase provides automatic connection pooling
- Consider Supabase's real-time features for multi-tab sync (optional)

**User Experience:**
- Maintain current simplicity and speed
- Avoid over-engineering; keep it lightweight
- Supabase client provides optimistic updates and caching
- Progressive enhancement approach
- Mobile-first responsive design
- Social login for frictionless authentication

**Data Model Evolution:**
Bookmark object structure:
```javascript
{
  // Core fields (Phase 1 - Supabase migration)
  id: uuid,                // Auto-generated by Supabase
  user_id: uuid,           // Foreign key to auth.users (automatic from RLS)
  url: string,             // Original bookmark URL
  page_title: string,      // Extracted from <title> or Open Graph
  meta_description: string,// Extracted from meta description
  preview_img: string,     // OG image, Twitter image, or fallback
  created_at: timestamp,   // Auto-generated by Supabase
  updated_at: timestamp,   // Auto-updated by Supabase

  // Phase 2 additions (Essential reading list features)
  is_read: boolean,        // Read/unread status
  read_at: timestamp,      // When marked as read
  tags: string[],          // Postgres array of strings

  // Phase 3 additions (Data & workflow)
  priority: integer,       // 0-3: none, low, medium, high
  notes: text,             // Simple text field, not rich text
  archived: boolean,       // Archive status
  archived_at: timestamp   // When archived
}
```

**Supabase Database Schema (Phase 1):**
```sql
-- Note: Supabase provides auth.users table automatically
-- We just need to create the bookmarks table

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bookmarks table
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_title TEXT NOT NULL,
  meta_description TEXT,
  preview_img TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  notes TEXT,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_user_bookmarks ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_user_unread ON bookmarks(user_id, is_read);
CREATE INDEX idx_tags ON bookmarks USING GIN(tags);

-- Row Level Security (RLS) Policies
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own bookmarks
CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookmarks
CREATE POLICY "Users can update their own bookmarks"
  ON bookmarks FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Full-text search (Phase 2) - Uses Postgres built-in FTS
ALTER TABLE bookmarks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(page_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(meta_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(url, '')), 'C')
  ) STORED;

CREATE INDEX idx_search_vector ON bookmarks USING GIN(search_vector);
```

**Supabase Integration Architecture:**
- **Database**: Postgres with automatic backups and scaling
- **Authentication**: Built-in Supabase Auth with social providers
  - Google, GitHub, GitLab OAuth
  - Email/password
  - Magic links
  - No custom auth code needed
- **Row Level Security**: Automatic user data isolation via RLS policies
- **Client Library**: `@supabase/supabase-js` for frontend
- **Real-time** (optional): Subscribe to bookmark changes across devices
- **Benefits**:
  - Zero auth boilerplate - handled by Supabase
  - Automatic user isolation via RLS
  - Built-in session management
  - Instant multi-device access
  - No conflict resolution needed
  - Postgres power (arrays, full-text search, JSON, etc.)
  - Storage service for preview images if needed
