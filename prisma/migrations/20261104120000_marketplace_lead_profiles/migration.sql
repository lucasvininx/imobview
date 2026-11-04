BEGIN;

ALTER TABLE public."Property" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
UPDATE public."Property" SET "isDemo"=true WHERE slug IN ('casa-horizonte-demo','apartamento-jardim-demo','refugio-contemporaneo-demo','imovel-privado-b','casa-modelo-tour-360');

ALTER TABLE public."Lead" ALTER COLUMN "propertyId" DROP NOT NULL,
 ADD COLUMN cpf VARCHAR(11) NOT NULL DEFAULT '',
 ADD COLUMN "birthDate" DATE,
 ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 ADD CONSTRAINT lead_cpf_format CHECK (cpf = '' OR cpf ~ '^[0-9]{11}$');
CREATE INDEX "Property_marketplace_idx" ON public."Property"(purpose,type,"publishedAt" DESC) WHERE status='PUBLISHED' AND "archivedAt" IS NULL;

CREATE OR REPLACE FUNCTION public.notify_new_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.notify_lead_team(NEW.id,'LEAD','Novo lead',NEW.name||coalesce(' se cadastrou em '||(SELECT title FROM public."Property" WHERE id=NEW."propertyId"),' foi cadastrado na base de clientes.'));
 RETURN NEW;
END $$;

-- Accent-insensitive matching without an extension or changes to tenant RLS.
CREATE FUNCTION public.marketplace_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=pg_catalog AS $$
 SELECT translate(lower(coalesce(value,'')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

-- Explicit public projection. Address, owner ids, internal notes and contact records are never returned.
CREATE FUNCTION public.search_published_properties(filters jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH matching AS (
  SELECT p.title,p.slug,p.description,p.city,p.state,p.neighborhood,p."priceCents",p.area,p.bedrooms,p.bathrooms,p."parkingSpaces",p.cover,p.purpose,p.type,p."publishedAt",
   o.name AS "organizationName",
   (SELECT a."storageKey" FROM public."PropertyPhoto" a WHERE a."propertyId"=p.id AND a."organizationId"=p."organizationId" AND a.status='READY' ORDER BY a."createdAt",a.id LIMIT 1) AS "photoKey",
   EXISTS(SELECT 1 FROM public."Tour" t WHERE t."propertyId"=p.id AND t."organizationId"=p."organizationId" AND t.status='PUBLISHED' AND t.published IS NOT NULL) AS "hasTour"
  FROM public."Property" p JOIN public."Organization" o ON o.id=p."organizationId"
  WHERE p.status='PUBLISHED' AND p."archivedAt" IS NULL
   AND NOT p."isDemo" AND p."priceCents">0 AND p.area>0 AND p.city<>''
   AND p.slug<>coalesce(filters->>'demoSlug','')
   AND (coalesce(filters->>'purpose','')='' OR p.purpose::text=filters->>'purpose')
   AND (coalesce(filters->>'type','')='' OR p.type::text=filters->>'type')
   AND public.marketplace_normalize(p.city) LIKE '%'||public.marketplace_normalize(filters->>'city')||'%'
   AND public.marketplace_normalize(p.neighborhood) LIKE '%'||public.marketplace_normalize(filters->>'neighborhood')||'%'
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

-- Resolves the destination organization from the published property, never from caller input.
CREATE FUNCTION public.register_marketplace_interest(payload jsonb, abuse_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public."Property"; attempts integer; rate_key text; existing uuid;
BEGIN
 IF abuse_key IS NULL OR abuse_key !~ '^[a-f0-9]{64}$'
 OR (payload->>'consent') IS DISTINCT FROM 'true'
 OR coalesce(length(payload->>'name'),0) NOT BETWEEN 3 AND 160
 OR coalesce(length(payload->>'email'),0) NOT BETWEEN 3 AND 254
 OR coalesce(payload->>'phone','') !~ '^[0-9]{10,15}$'
 THEN RETURN false; END IF;
 SELECT * INTO p FROM public."Property" WHERE slug=payload->>'slug' AND status='PUBLISHED' AND "archivedAt" IS NULL;
 IF p.id IS NULL OR p."isDemo" THEN RETURN false; END IF;
 rate_key:='marketplace:'||abuse_key||':'||floor(extract(epoch from now())/3600)::text;
 INSERT INTO public."RateLimit"(id,key,count,"lastRequest") VALUES(gen_random_uuid()::text,rate_key,1,(extract(epoch from now())*1000)::bigint)
 ON CONFLICT (key) DO UPDATE SET count="RateLimit".count+1,"lastRequest"=EXCLUDED."lastRequest" RETURNING count INTO attempts;
 IF attempts>10 THEN RETURN false; END IF;
 -- Share the same organization lock as tour registration/assignment; repeated clicks do not create new leads.
 PERFORM 1 FROM public."Organization" WHERE id=p."organizationId" FOR UPDATE;
 SELECT id INTO existing FROM public."Lead" WHERE "organizationId"=p."organizationId" AND "propertyId"=p.id
  AND email=lower(payload->>'email') AND phone=payload->>'phone' ORDER BY "createdAt" DESC LIMIT 1;
 IF existing IS NULL THEN
  INSERT INTO public."Lead"(id,"organizationId","propertyId",name,email,phone,source,"consentVersion","updatedAt")
   VALUES(gen_random_uuid(),p."organizationId",p.id,payload->>'name',lower(payload->>'email'),payload->>'phone','marketplace','marketplace-v1',now());
 END IF;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.marketplace_normalize(text),public.search_published_properties(jsonb),public.register_marketplace_interest(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_normalize(text),public.search_published_properties(jsonb),public.register_marketplace_interest(jsonb,text) TO imobview_app;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION public.marketplace_normalize(text),public.search_published_properties(jsonb),public.register_marketplace_interest(jsonb,text) FROM %I',api_role);
  END IF;
 END LOOP;
END $$;
COMMIT;
