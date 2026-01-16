-- LinkStack Supabase Database Schema
-- Run this in your Supabase SQL Editor after creating your project

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
  parent_id UUID REFERENCES bookmarks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate URLs per user
ALTER TABLE bookmarks
ADD CONSTRAINT unique_user_url UNIQUE (user_id, url);

-- Index for common queries
CREATE INDEX idx_user_bookmarks ON bookmarks(user_id, created_at DESC);
CREATE INDEX idx_user_unread ON bookmarks(user_id, is_read);
CREATE INDEX idx_tags ON bookmarks USING GIN(tags);
CREATE INDEX idx_parent_bookmarks ON bookmarks(parent_id);

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

-- Full-text search - Uses Postgres built-in FTS
-- This creates a generated column for efficient searching
ALTER TABLE bookmarks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(page_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(meta_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(url, '')), 'C')
  ) STORED;

CREATE INDEX idx_search_vector ON bookmarks USING GIN(search_vector);
