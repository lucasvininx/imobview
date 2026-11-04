BEGIN;

-- Demonstrative listings are explicitly identified in the public projection.
CREATE OR REPLACE FUNCTION public.search_published_properties(filters jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH matching AS (
  SELECT p.title,p.slug,p.description,p.city,p.state,p.neighborhood,p."priceCents",p.area,p.bedrooms,p.bathrooms,p."parkingSpaces",p.cover,p.purpose,p.type,p."publishedAt",p."isDemo",
   o.name AS "organizationName",
   (SELECT a."storageKey" FROM public."PropertyPhoto" a WHERE a."propertyId"=p.id AND a."organizationId"=p."organizationId" AND a.status='READY' ORDER BY a."createdAt",a.id LIMIT 1) AS "photoKey",
   EXISTS(SELECT 1 FROM public."Tour" t WHERE t."propertyId"=p.id AND t."organizationId"=p."organizationId" AND t.status='PUBLISHED' AND t.published IS NOT NULL) AS "hasTour"
  FROM public."Property" p JOIN public."Organization" o ON o.id=p."organizationId"
  WHERE p.status='PUBLISHED' AND p."archivedAt" IS NULL
   AND p."priceCents">0 AND p.area>0 AND p.city<>''
   AND (coalesce(filters->>'purpose','')='' OR p.purpose::text=filters->>'purpose')
   AND (coalesce(filters->>'type','')='' OR p.type::text=filters->>'type')
   AND position(public.marketplace_normalize(filters->>'city') in public.marketplace_normalize(p.city))>0
   AND position(public.marketplace_normalize(filters->>'neighborhood') in public.marketplace_normalize(p.neighborhood))>0
   AND p.bedrooms >= coalesce((filters->>'bedrooms')::integer,0)
   AND p.bathrooms >= coalesce((filters->>'bathrooms')::integer,0)
   AND p."parkingSpaces" >= coalesce((filters->>'parkingSpaces')::integer,0)
   AND p.suites >= coalesce((filters->>'suites')::integer,0)
   AND (coalesce((filters->>'maxPrice')::numeric,0)=0 OR p."priceCents" <= (filters->>'maxPrice')::numeric*100)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(filters->'tokens','[]'::jsonb)) token
    WHERE position(public.marketplace_normalize(token) in public.marketplace_normalize(concat_ws(' ',p.title,p.city,p.neighborhood,p.state,p.description)))=0)
 ), page AS (
  SELECT * FROM matching ORDER BY
   CASE WHEN filters->>'sort'='price-asc' THEN "priceCents" END ASC,
   CASE WHEN filters->>'sort'='price-desc' THEN "priceCents" END DESC,
   "publishedAt" DESC NULLS LAST,slug
  LIMIT 12 OFFSET (greatest(1,least(coalesce((filters->>'page')::integer,1),10000))-1)*12
 )
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matching),'items',coalesce((SELECT jsonb_agg(to_jsonb(page)-'publishedAt'-'description') FROM page),'[]'::jsonb));
$$;

CREATE FUNCTION public.get_public_property_flags(requested_slug text)
RETURNS TABLE ("isDemo" boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p."isDemo" FROM public."Property" p WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_property_flags(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_property_flags(text) TO imobview_app;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION public.get_public_property_flags(text) FROM %I',api_role);
  END IF;
 END LOOP;
END $$;
COMMIT;
