-- Auth and membership tables are accessed only by the trusted backend role.
-- Supabase Data API roles must never inherit access to Better Auth sessions.
DO $$
DECLARE table_name text; api_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['User','Account','Session','Verification','RateLimit','Organization','OrganizationMember'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY backend_only ON public.%I FOR ALL USING (current_user = ''imobview_app'') WITH CHECK (current_user = ''imobview_app'')', table_name);
  END LOOP;
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      FOREACH table_name IN ARRAY ARRAY['User','Account','Session','Verification','RateLimit','Organization','OrganizationMember','Property','Tour','PanoramaAsset','_prisma_migrations'] LOOP
        EXECUTE format('REVOKE ALL ON public.%I FROM %I', table_name, api_role);
      END LOOP;
      EXECUTE format('REVOKE ALL ON FUNCTION public.get_published_property(text), public.get_published_tours(text) FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_published_tours(requested_slug text)
RETURNS TABLE (id uuid, title text, document jsonb, assets jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT t.id,COALESCE(t.published->>'title',t.title)::text,t.published,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'storageKey',a."storageKey")) FROM public."PanoramaAsset" a WHERE a."tourId"=t.id AND a."organizationId"=t."organizationId" AND a.status='READY' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.published->'scenes') scene WHERE scene->>'assetId'=a.id::text)),'[]'::jsonb)
 FROM public."Tour" t JOIN public."Property" p ON p.id=t."propertyId" AND p."organizationId"=t."organizationId"
 WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL AND t.status='PUBLISHED' AND t.published IS NOT NULL ORDER BY t."createdAt" LIMIT 10;
$$;
