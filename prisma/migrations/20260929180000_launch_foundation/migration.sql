ALTER TABLE "Organization"
 ADD COLUMN "contactEmail" varchar(254) NOT NULL DEFAULT '',
 ADD COLUMN "whatsapp" varchar(15) NOT NULL DEFAULT '',
 ADD COLUMN "maxProperties" integer NOT NULL DEFAULT 30,
 ADD COLUMN "maxStorageBytes" bigint NOT NULL DEFAULT 2147483648,
 ADD COLUMN "maxPanoramas" integer NOT NULL DEFAULT 300;
ALTER TABLE "Organization" ADD CONSTRAINT organization_limits_positive CHECK
 ("maxProperties" > 0 AND "maxStorageBytes" > 0 AND "maxPanoramas" > 0);

CREATE TABLE "PropertyPhoto" (
 "id" uuid PRIMARY KEY,
 "organizationId" uuid NOT NULL,
 "propertyId" uuid NOT NULL,
 "storageKey" text NOT NULL UNIQUE,
 "uploadKey" text NOT NULL UNIQUE,
 "fileName" varchar(160) NOT NULL,
 "size" integer NOT NULL CHECK (size > 0 AND size <= 10485760),
 "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
 "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" timestamptz(3) NOT NULL,
 FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"(id, "organizationId") ON DELETE CASCADE
);
CREATE INDEX "PropertyPhoto_organizationId_propertyId_status_idx" ON "PropertyPhoto"("organizationId","propertyId",status);
ALTER TABLE "PropertyPhoto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_read ON "PropertyPhoto" FOR SELECT USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PropertyPhoto"."organizationId" AND m."userId"=current_setting('app.user_id',true))
);
CREATE POLICY photo_write ON "PropertyPhoto" FOR ALL USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PropertyPhoto"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
) WITH CHECK (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PropertyPhoto"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
);
CREATE POLICY asset_delete ON "PanoramaAsset" FOR DELETE USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="PanoramaAsset"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))
);
CREATE FUNCTION public.get_property_presentation(requested_slug text)
RETURNS TABLE ("contactEmail" text, whatsapp text, photos jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT o."contactEmail"::text, o.whatsapp::text,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'storageKey',a."storageKey") ORDER BY a."createdAt") FROM public."PropertyPhoto" a WHERE a."propertyId"=p.id AND a."organizationId"=p."organizationId" AND a.status='READY'),'[]'::jsonb)
 FROM public."Property" p JOIN public."Organization" o ON o.id=p."organizationId"
 WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_property_presentation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_property_presentation(text) TO imobview_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON "PropertyPhoto" TO imobview_app;
GRANT DELETE ON "PanoramaAsset" TO imobview_app;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
   EXECUTE format('REVOKE ALL ON public."PropertyPhoto" FROM %I',api_role);
   EXECUTE format('REVOKE ALL ON FUNCTION public.get_property_presentation(text) FROM %I',api_role);
  END IF;
 END LOOP;
END $$;
