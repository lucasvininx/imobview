ALTER TABLE "Tour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PanoramaAsset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tour_read ON "Tour" FOR SELECT USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="Tour"."organizationId" AND m."userId"=current_setting('app.user_id',true))
);
CREATE POLICY tour_insert ON "Tour" FOR INSERT WITH CHECK (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="Tour"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
);
CREATE POLICY tour_update ON "Tour" FOR UPDATE USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="Tour"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
) WITH CHECK ("organizationId"::text=current_setting('app.organization_id',true));
CREATE POLICY asset_read ON "PanoramaAsset" FOR SELECT USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PanoramaAsset"."organizationId" AND m."userId"=current_setting('app.user_id',true))
);
CREATE POLICY asset_insert ON "PanoramaAsset" FOR INSERT WITH CHECK (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PanoramaAsset"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
);
CREATE POLICY asset_update ON "PanoramaAsset" FOR UPDATE USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PanoramaAsset"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
) WITH CHECK ("organizationId"::text=current_setting('app.organization_id',true));
ALTER TABLE "PanoramaAsset" ADD CONSTRAINT asset_size_limit CHECK (size > 0 AND size <= 20971520);
CREATE FUNCTION public.get_published_tours(requested_slug text)
RETURNS TABLE (id uuid, title text, document jsonb, assets jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT t.id,t.title::text,t.published,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'storageKey',a."storageKey")) FROM public."PanoramaAsset" a WHERE a."tourId"=t.id AND a."organizationId"=t."organizationId" AND a.status='READY' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.published->'scenes') scene WHERE scene->>'assetId'=a.id::text)),'[]'::jsonb)
 FROM public."Tour" t JOIN public."Property" p ON p.id=t."propertyId" AND p."organizationId"=t."organizationId"
 WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL AND t.status='PUBLISHED' AND t.published IS NOT NULL ORDER BY t."createdAt" LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.get_published_tours(text) FROM PUBLIC;
