-- Fix production overflow when display_order stores millisecond timestamps.
-- This is additive/safe for existing rows because INTEGER -> BIGINT widens the type.

ALTER TABLE public.public_stack_items
  ALTER COLUMN display_order TYPE BIGINT;
