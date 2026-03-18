-- Migration: allow authenticated users to read orphan resources
-- Date: 2026-03-18
-- Description:
--   Non-admin users can create a new resource, but the create flow currently
--   performs INSERT ... SELECT to return the new row. Immediately after insert,
--   the resource has no bookmark and no public listing yet, so the previous
--   SELECT policy blocked access with a 403.
--
--   This migration allows authenticated users to read orphan resources:
--   resources with no bookmarks and no public listing. That covers the
--   just-created resource during bookmark creation without opening general
--   access to private linked resources.

DROP POLICY IF EXISTS "resource owners and public catalog can read resources"
  ON public.resources;

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
  );
