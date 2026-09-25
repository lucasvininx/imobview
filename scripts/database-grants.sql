-- Run once as the migration/admin role, after migrations, in each database.
-- Provision imobview_app separately with a strong password in production.
GRANT USAGE ON SCHEMA public TO imobview_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "User", "Session", "Account", "Verification", "RateLimit", "Organization", "OrganizationMember" TO imobview_app;
GRANT SELECT, INSERT, UPDATE ON "Property" TO imobview_app;
GRANT EXECUTE ON FUNCTION public.get_published_property(text) TO imobview_app;
