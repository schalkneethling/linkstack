-- Make public stack roots self-sufficient for public catalog reads.
-- This avoids querying private bookmarks to resolve the stack URL/resource.

ALTER TABLE public.public_stacks
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE;

UPDATE public.public_stacks
SET resource_id = bookmarks.resource_id
FROM public.bookmarks
WHERE bookmarks.id = public_stacks.root_bookmark_id
  AND public_stacks.resource_id IS NULL;

ALTER TABLE public.public_stacks
  ALTER COLUMN resource_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_public_stacks_resource
  ON public.public_stacks(resource_id);

DROP POLICY IF EXISTS "owners can submit public stacks" ON public.public_stacks;
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
        AND bookmarks.resource_id = public_stacks.resource_id
    )
  );

DROP POLICY IF EXISTS "resource owners and public catalog can read resources" ON public.resources;
CREATE POLICY "resource owners and public catalog can read resources"
  ON public.resources
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookmarks
        WHERE bookmarks.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_listings
        WHERE public_listings.resource_id = resources.id
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.resource_id = resources.id
        AND bookmarks.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_listings
      WHERE public_listings.resource_id = resources.id
        AND public_listings.status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.resource_id = resources.id
        AND public_stacks.status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_stack_items
      WHERE public_stack_items.resource_id = resources.id
        AND public_stack_items.status = 'approved'
    )
  );
