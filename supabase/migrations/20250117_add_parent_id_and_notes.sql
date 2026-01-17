-- Migration: Add parent_id for bookmark threads and notes for personal annotations
-- Date: 2025-01-17
-- Description: This migration adds support for bookmark threads (parent-child relationships)
--              and personal notes on bookmarks

-- Add parent_id column for bookmark threads
-- If the parent bookmark is deleted, set children's parent_id to NULL (orphan them)
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL;

-- Add notes column for personal annotations
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for parent_id lookups (for fetching children)
CREATE INDEX IF NOT EXISTS idx_parent_bookmarks ON bookmarks(parent_id);

-- Note: The base schema.sql already includes these columns for new installations
-- This migration is for existing databases created before these features were added
