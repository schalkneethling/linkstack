-- Migration: Add parent_id column for bookmark threads
-- Date: 2026-01-16

-- Add parent_id column to bookmarks table
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL;

-- Create index for parent_id queries
CREATE INDEX IF NOT EXISTS idx_parent_bookmarks ON bookmarks(parent_id);

-- Add comment for documentation
COMMENT ON COLUMN bookmarks.parent_id IS 'Reference to parent bookmark for threading/grouping. NULL for top-level bookmarks. ON DELETE SET NULL ensures children become top-level when parent is deleted.';
