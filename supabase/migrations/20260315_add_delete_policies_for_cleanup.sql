-- Migration: add delete policies for public listings and orphan resources
-- Date: 2026-03-15
-- Description:
--   Bookmark deletion now cleans up associated public_listings and orphaned
--   resources. RLS previously allowed SELECT/INSERT/UPDATE on these tables but
--   did not allow DELETE, which caused silent no-op deletes through PostgREST.
--
--   This migration:
--   - allows owners/admins to delete public listings
--   - allows admins or any authenticated user to delete resources only once
--     those resources are orphaned (no bookmarks and no public listing remain)

CREATE POLICY "admins and authenticated users can delete orphan resources"
  ON public.resources
  FOR DELETE
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
  );

CREATE POLICY "owners and admins can delete public listings"
  ON public.public_listings
  FOR DELETE
  USING (
    public.is_admin()
    OR submitted_by_user_id = auth.uid()
  );
