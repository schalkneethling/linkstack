-- Additive migration for public stack support.
-- This migration intentionally preserves existing bookmarks, parent/child
-- relationships, and standalone public listings. No existing rows are mutated.

CREATE TABLE IF NOT EXISTS public.public_stacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  root_bookmark_id UUID NOT NULL UNIQUE REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  page_title TEXT NOT NULL,
  meta_description TEXT DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  rejection_code TEXT,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_stack_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_stack_id UUID NOT NULL REFERENCES public.public_stacks(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL UNIQUE REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  source_public_listing_id UUID REFERENCES public.public_listings(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  page_title TEXT NOT NULL,
  meta_description TEXT DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  display_order BIGINT NOT NULL DEFAULT 0,
  rejection_code TEXT,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_public_stack_resource UNIQUE (public_stack_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_public_stacks_status
  ON public.public_stacks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_stacks_owner
  ON public.public_stacks(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_stack_items_status
  ON public.public_stack_items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_stack_items_stack
  ON public.public_stack_items(public_stack_id, display_order);
CREATE INDEX IF NOT EXISTS idx_public_stack_items_resource
  ON public.public_stack_items(resource_id);

DROP TRIGGER IF EXISTS update_public_stacks_updated_at ON public.public_stacks;
CREATE TRIGGER update_public_stacks_updated_at
  BEFORE UPDATE ON public.public_stacks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_public_stack_items_updated_at ON public.public_stack_items;
CREATE TRIGGER update_public_stack_items_updated_at
  BEFORE UPDATE ON public.public_stack_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.public_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_stack_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved public stacks are public"
  ON public.public_stacks
  FOR SELECT
  USING (
    status = 'approved'
    OR public.is_admin()
    OR owner_user_id = auth.uid()
  );

CREATE POLICY "owners can submit public stacks"
  ON public.public_stacks
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_user_id
    AND EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.id = root_bookmark_id
        AND bookmarks.user_id = auth.uid()
        AND bookmarks.parent_id IS NULL
    )
  );

CREATE POLICY "owners and admins can update public stacks"
  ON public.public_stacks
  FOR UPDATE
  USING (
    public.is_admin()
    OR owner_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR owner_user_id = auth.uid()
  );

CREATE POLICY "owners and admins can delete public stacks"
  ON public.public_stacks
  FOR DELETE
  USING (
    public.is_admin()
    OR owner_user_id = auth.uid()
  );

CREATE POLICY "approved public stack items are public"
  ON public.public_stack_items
  FOR SELECT
  USING (
    status = 'approved'
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "owners can submit public stack items"
  ON public.public_stack_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.public_stacks
      JOIN public.bookmarks root_bookmarks
        ON root_bookmarks.id = public_stacks.root_bookmark_id
      JOIN public.bookmarks child_bookmarks
        ON child_bookmarks.id = public_stack_items.bookmark_id
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
        AND child_bookmarks.user_id = auth.uid()
        AND child_bookmarks.parent_id = root_bookmarks.id
        AND child_bookmarks.resource_id = public_stack_items.resource_id
    )
  );

CREATE POLICY "owners and admins can update public stack items"
  ON public.public_stack_items
  FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "owners and admins can delete public stack items"
  ON public.public_stack_items
  FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  );

-- Verification helpers to run manually after deploy:
-- 1. Existing bookmark counts must remain unchanged.
-- 2. Existing public_listings counts and statuses must remain unchanged.
-- 3. No rows should exist in public_stacks/public_stack_items until a user
--    explicitly publishes a stack after this migration ships.
