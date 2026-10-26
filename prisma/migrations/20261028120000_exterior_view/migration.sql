-- 3D exterior view (parametric condominium model and sun study) configured per property.
ALTER TABLE "Property" ADD COLUMN "exterior" JSONB;

-- Public projection: only enabled views of published properties, with coordinates rounded to
-- ~1 km. That is enough for the sun position and does not reveal the exact address.
CREATE FUNCTION public.get_exterior_view(requested_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.exterior
   || jsonb_build_object(
     'latitude', round((p.exterior->>'latitude')::numeric, 2),
     'longitude', round((p.exterior->>'longitude')::numeric, 2))
 FROM public."Property" p
 WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL
   AND (p.exterior->>'enabled')::boolean IS TRUE
 LIMIT 1;
$$;

DO $$ DECLARE api_role text; BEGIN
 REVOKE ALL ON FUNCTION public.get_exterior_view(text) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.get_exterior_view(text) TO imobview_app;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE 'REVOKE ALL ON FUNCTION public.get_exterior_view(text) FROM '||quote_ident(api_role); END IF;
 END LOOP;
END $$;
