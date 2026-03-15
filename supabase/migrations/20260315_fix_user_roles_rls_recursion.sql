-- Migration: fix recursive RLS checks on public.user_roles
-- Date: 2026-03-15
-- Description:
--   The original is_admin() helper queried public.user_roles while RLS policies on
--   public.user_roles also called is_admin(). That caused recursive policy evaluation
--   and "stack depth limit exceeded" errors during admin checks.
--
--   This migration makes is_admin() SECURITY DEFINER so it can evaluate against
--   public.user_roles without re-entering the same RLS policies.

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
