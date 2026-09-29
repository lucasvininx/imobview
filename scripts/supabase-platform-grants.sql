-- Run as the Supabase project administrator after migrations.
-- This optional platform helper may be installed automatically by Supabase.
-- Event triggers do not need to expose the helper through the Data API.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
  END IF;
END $$;

-- Prisma's internal history is only accessible to the migration owner.
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
