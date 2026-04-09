-- LinkStack normalized schema
-- resources: shared link identity + fetched metadata
-- bookmarks: per-user library entries
-- public_listings: moderated standalone public catalog entries for resources
-- public_stacks: moderated public collection roots linked to top-level bookmarks
-- public_stack_items: membership and moderation state for child bookmarks inside a public stack

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  normalized_url TEXT NOT NULL UNIQUE,
  canonical_url TEXT NOT NULL,
  page_title TEXT NOT NULL,
  meta_description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.bookmarks(id) ON DELETE SET NULL,
  title_override TEXT,
  description_override TEXT,
  notes TEXT DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_resource UNIQUE (user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS public.public_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL UNIQUE REFERENCES public.resources(id) ON DELETE CASCADE,
  submitted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_bookmark_id UUID REFERENCES public.bookmarks(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.public_stacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  root_bookmark_id UUID NOT NULL UNIQUE REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  highlight_color TEXT NOT NULL DEFAULT 'default'
    CHECK (highlight_color IN ('default', 'amber', 'cobalt', 'rose', 'plum', 'moss')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'admin'
  );
$$;

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created
  ON public.bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_parent
  ON public.bookmarks(parent_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_resource
  ON public.bookmarks(resource_id);
CREATE INDEX IF NOT EXISTS idx_public_listings_status
  ON public.public_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_listings_resource
  ON public.public_listings(resource_id);
CREATE INDEX IF NOT EXISTS idx_public_stacks_status
  ON public.public_stacks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_stacks_owner
  ON public.public_stacks(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_stacks_resource
  ON public.public_stacks(resource_id);
CREATE INDEX IF NOT EXISTS idx_public_stack_items_status
  ON public.public_stack_items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_stack_items_stack
  ON public.public_stack_items(public_stack_id, display_order);
CREATE INDEX IF NOT EXISTS idx_public_stack_items_resource
  ON public.public_stack_items(resource_id);
CREATE INDEX IF NOT EXISTS idx_resources_normalized_url
  ON public.resources(normalized_url);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_resources_updated_at ON public.resources;
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookmarks_updated_at ON public.bookmarks;
CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON public.bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_public_listings_updated_at ON public.public_listings;
CREATE TRIGGER update_public_listings_updated_at
  BEFORE UPDATE ON public.public_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_stack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmark owners can manage their bookmarks"
  ON public.bookmarks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "authenticated users can create resources"
  ON public.resources
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "bookmark owners and admins can update resources"
  ON public.resources
  FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.resource_id = resources.id
        AND bookmarks.user_id = auth.uid()
    )
  );

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

CREATE POLICY "approved public listings are public"
  ON public.public_listings
  FOR SELECT
  USING (
    status = 'approved'
    OR public.is_admin()
    OR submitted_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.resource_id = public_listings.resource_id
        AND bookmarks.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can submit public listings"
  ON public.public_listings
  FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by_user_id
    AND EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.id = submitted_by_bookmark_id
        AND bookmarks.user_id = auth.uid()
    )
  );

CREATE POLICY "owners and admins can update public listings"
  ON public.public_listings
  FOR UPDATE
  USING (
    public.is_admin()
    OR submitted_by_user_id = auth.uid()
  );

CREATE POLICY "owners and admins can delete public listings"
  ON public.public_listings
  FOR DELETE
  USING (
    public.is_admin()
    OR submitted_by_user_id = auth.uid()
  );

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
        AND bookmarks.resource_id = public_stacks.resource_id
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

CREATE POLICY "admins can view user roles"
  ON public.user_roles
  FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "admins can manage user roles"
  ON public.user_roles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "users can manage their preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
