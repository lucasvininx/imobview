-- The runtime role MUST NOT own these tables and MUST NOT have BYPASSRLS.
ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property" FORCE ROW LEVEL SECURITY;

CREATE POLICY property_tenant_read ON "Property" FOR SELECT USING (
  "organizationId"::text = current_setting('app.organization_id', true)
  AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId" = "Property"."organizationId" AND m."userId" = current_setting('app.user_id', true))
);
CREATE POLICY property_tenant_insert ON "Property" FOR INSERT WITH CHECK (
  "organizationId"::text = current_setting('app.organization_id', true)
  AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId" = "Property"."organizationId" AND m."userId" = current_setting('app.user_id', true) AND m.role IN ('OWNER', 'ADMIN', 'MEMBER'))
);
CREATE POLICY property_tenant_update ON "Property" FOR UPDATE USING (
  "organizationId"::text = current_setting('app.organization_id', true)
  AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId" = "Property"."organizationId" AND m."userId" = current_setting('app.user_id', true) AND m.role IN ('OWNER', 'ADMIN', 'MEMBER'))
) WITH CHECK ("organizationId"::text = current_setting('app.organization_id', true));

ALTER TABLE "Property" ADD CONSTRAINT property_nonnegative CHECK ("priceCents" >= 0 AND area >= 0 AND bedrooms >= 0 AND bathrooms >= 0 AND "parkingSpaces" >= 0);

-- Expose an allowlisted public projection, never the underlying tenant rows.
-- Owner executes this function; only published records can be returned.
CREATE FUNCTION public.get_published_property(requested_slug text)
RETURNS TABLE (title text, slug text, description text, city text, state text, neighborhood text, "priceCents" bigint, area integer, bedrooms integer, bathrooms integer, "parkingSpaces" integer, cover text, "organizationName" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 SELECT p.title::text, p.slug, p.description::text, p.city::text, p.state::text, p.neighborhood::text, p."priceCents", p.area, p.bedrooms, p.bathrooms, p."parkingSpaces", p.cover, o.name
 FROM public."Property" p JOIN public."Organization" o ON o.id=p."organizationId"
 WHERE p.slug = requested_slug AND p.status = 'PUBLISHED' AND p."archivedAt" IS NULL LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_published_property(text) FROM PUBLIC;
