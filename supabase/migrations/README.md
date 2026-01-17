# Supabase Migrations

This directory contains database migration files for LinkStack.

## For New Installations

If you're setting up LinkStack for the first time, **run the main schema file** instead of these migrations:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase/schema.sql
```

The main schema file includes all features and is the recommended approach for new projects.

## For Existing Installations

If you already have a LinkStack database running and need to add new features, run the appropriate migration files in order by date:

### Available Migrations

**`20250117_add_parent_id_and_notes.sql`**
- Adds `parent_id` column for bookmark threads (parent-child relationships)
- Adds `notes` column for personal annotations on bookmarks
- Creates index for efficient parent-child queries
- Safe to run multiple times (uses `IF NOT EXISTS`)

### How to Run Migrations

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor
5. Click "Run"

### Migration Safety

All migrations use `IF NOT EXISTS` or `IF EXISTS` clauses to be idempotent - they can be run multiple times safely without errors or data loss.

## Migration Naming Convention

Migrations are named using the format: `YYYYMMDD_description.sql`

This ensures they sort chronologically and are easy to identify.
