-- The narrowly scoped SECURITY DEFINER projection must work for managed
-- PostgreSQL migration owners that do not have BYPASSRLS. The separate runtime
-- role is neither table owner nor a member of that role, and remains under RLS.
ALTER TABLE "Property" NO FORCE ROW LEVEL SECURITY;
