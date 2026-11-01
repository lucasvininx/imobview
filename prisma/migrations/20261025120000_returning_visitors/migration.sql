-- Returning visitors: a browser keeps a random key whose SHA-256 hash links new visits to the same lead.
CREATE TABLE "LeadDevice" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadDevice_keyHash_key" ON "LeadDevice"("keyHash");

-- CreateIndex
CREATE INDEX "LeadDevice_leadId_idx" ON "LeadDevice"("leadId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_propertyId_email_idx" ON "Lead"("organizationId", "propertyId", "email");

-- CreateIndex
CREATE INDEX "Lead_organizationId_updatedAt_idx" ON "Lead"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "LeadDevice" ADD CONSTRAINT "LeadDevice_leadId_organizationId_fkey" FOREIGN KEY ("leadId", "organizationId") REFERENCES "Lead"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadDevice" ADD CONSTRAINT lead_device_key CHECK ("keyHash" ~ '^[a-f0-9]{64}$');

DO $$ DECLARE api_role text; BEGIN
 ALTER TABLE public."LeadDevice" ENABLE ROW LEVEL SECURITY;
 CREATE POLICY tenant_read ON public."LeadDevice" FOR SELECT USING ("organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="LeadDevice"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER')));
 CREATE POLICY tenant_write ON public."LeadDevice" FOR ALL USING ("organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="LeadDevice"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))) WITH CHECK ("organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="LeadDevice"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER')));
 REVOKE ALL ON public."LeadDevice" FROM PUBLIC;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public."LeadDevice" TO imobview_app;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON public."LeadDevice" FROM %I',api_role); END IF;
 END LOOP;
END $$;

-- Same signature as before; existing grants are preserved by CREATE OR REPLACE.
-- Returns NULL when a returning key is unknown so the browser can forget it.
CREATE OR REPLACE FUNCTION public.begin_tour_visit(payload jsonb, token_hash text, abuse_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public."Property"; t public."Tour"; visit_id uuid:=gen_random_uuid(); lead_id uuid; tracking boolean;
 contact_email text; contact_name text; contact_phone text; existing public."Lead"; device_hash text:=payload->>'deviceKeyHash'; return_hash text:=payload->>'returnKeyHash';
BEGIN
 IF token_hash !~ '^[a-f0-9]{64}$' OR abuse_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid capability'; END IF;
 IF (device_hash IS NOT NULL AND device_hash !~ '^[a-f0-9]{64}$') OR (return_hash IS NOT NULL AND return_hash !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'invalid capability'; END IF;
 IF return_hash IS NOT NULL AND payload ? 'contact' THEN RAISE EXCEPTION 'ambiguous identity'; END IF;
 SELECT * INTO p FROM public."Property" WHERE slug=payload->>'slug' AND status='PUBLISHED' AND "archivedAt" IS NULL;
 SELECT * INTO t FROM public."Tour" WHERE id=(payload->>'tourId')::uuid AND "propertyId"=p.id AND "organizationId"=p."organizationId" AND status='PUBLISHED' AND published IS NOT NULL;
 IF t.id IS NULL OR jsonb_array_length(t.published->'scenes')=0 THEN RAISE EXCEPTION 'unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(abuse_key,0));
 IF (SELECT count(*) FROM public."TourVisit" WHERE "abuseKey"=abuse_key AND "createdAt">now()-interval '1 hour')>=40 THEN RAISE EXCEPTION 'rate limit'; END IF;
 PERFORM 1 FROM public."Organization" WHERE id=p."organizationId" FOR UPDATE;
 IF (SELECT count(*) FROM public."TourVisit" WHERE "organizationId"=p."organizationId" AND "createdAt">now()-interval '1 day')>=5000 THEN RAISE EXCEPTION 'capacity'; END IF;
 tracking:=(payload->>'tracking')::boolean;
 IF return_hash IS NOT NULL THEN
  -- A key only resumes the lead of the property where it was issued.
  SELECT l.id INTO lead_id FROM public."LeadDevice" d JOIN public."Lead" l ON l.id=d."leadId" AND l."organizationId"=d."organizationId"
   WHERE d."keyHash"=return_hash AND l."propertyId"=p.id AND l."organizationId"=p."organizationId";
  IF lead_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public."LeadDevice" SET "lastUsedAt"=now() WHERE "keyHash"=return_hash;
  UPDATE public."Lead" SET "updatedAt"=now() WHERE id=lead_id;
 ELSIF payload ? 'contact' THEN
  contact_name:=payload->'contact'->>'name'; contact_email:=lower(payload->'contact'->>'email'); contact_phone:=payload->'contact'->>'phone';
  IF (payload->'contact'->>'consent') IS DISTINCT FROM 'true' OR length(contact_name) NOT BETWEEN 3 AND 160 OR length(contact_email) NOT BETWEEN 3 AND 254 OR contact_phone !~ '^[0-9]{10,15}$' THEN RAISE EXCEPTION 'invalid contact'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p.id::text||':'||contact_email,0));
  SELECT * INTO existing FROM public."Lead" WHERE "organizationId"=p."organizationId" AND "propertyId"=p.id AND email=contact_email ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE;
  IF existing.id IS NULL THEN
   lead_id:=gen_random_uuid();
   INSERT INTO public."Lead"(id,"organizationId","propertyId",name,email,phone,source,"updatedAt") VALUES(lead_id,p."organizationId",p.id,contact_name,contact_email,contact_phone,left(coalesce(payload->>'source','direct'),120),now());
  ELSE
   -- Never overwrite stored contact data: anyone can type an e-mail. Differences become a note for the team.
   lead_id:=existing.id;
   UPDATE public."Lead" SET "updatedAt"=now(),"consentAt"=now(),
    stage=CASE WHEN stage='LOST' THEN 'NEW' ELSE stage END,
    notes=CASE WHEN (name IS DISTINCT FROM contact_name OR phone IS DISTINCT FROM contact_phone)
      AND length(notes)<4700 THEN left(notes||CASE WHEN notes='' THEN '' ELSE E'\n' END||'[Retorno '||to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY')||'] Contato informado: '||contact_name||' · '||contact_phone,5000) ELSE notes END
   WHERE id=lead_id;
  END IF;
  IF device_hash IS NOT NULL THEN
   INSERT INTO public."LeadDevice"(id,"organizationId","leadId","keyHash") VALUES(gen_random_uuid(),p."organizationId",lead_id,device_hash);
   DELETE FROM public."LeadDevice" WHERE id IN (SELECT id FROM public."LeadDevice" WHERE "leadId"=lead_id ORDER BY "lastUsedAt" DESC OFFSET 10);
  END IF;
 ELSIF NOT tracking THEN RAISE EXCEPTION 'consent required'; END IF;
 INSERT INTO public."TourVisit"(id,"organizationId","propertyId","tourId","leadId","tokenHash","abuseKey",source,tracking,scenes,"expiresAt") VALUES(visit_id,p."organizationId",p.id,t.id,lead_id,token_hash,abuse_key,left(coalesce(payload->>'source','direct'),120),tracking,(SELECT jsonb_agg(jsonb_build_object('id',s->>'id','title',s->>'title')) FROM jsonb_array_elements(t.published->'scenes') s),now()+interval '24 hours');
 RETURN visit_id;
END $$;

-- Returning leads keep their history, so cap pending requests instead of lifetime requests.
CREATE OR REPLACE FUNCTION public.request_property_visit(token_hash text, requested_date text, requested_period text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public."TourVisit";
BEGIN
 SELECT * INTO v FROM public."TourVisit" WHERE "tokenHash"=token_hash AND "expiresAt">now() FOR UPDATE;
 IF v.id IS NULL OR v."leadId" IS NULL OR requested_period NOT IN ('MORNING','AFTERNOON','EVENING') OR requested_date::date<current_date OR requested_date::date>current_date+180 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."Property" WHERE id=v."propertyId" AND status='PUBLISHED') THEN RETURN false; END IF;
 PERFORM 1 FROM public."Lead" WHERE id=v."leadId" FOR UPDATE;
 IF (SELECT count(*) FROM public."VisitRequest" WHERE "leadId"=v."leadId" AND status='REQUESTED')>=3 THEN RETURN false; END IF;
 INSERT INTO public."VisitRequest"(id,"organizationId","leadId","preferredDate",period,"updatedAt") VALUES(gen_random_uuid(),v."organizationId",v."leadId",requested_date,requested_period,now()) ON CONFLICT ("leadId","preferredDate",period) DO NOTHING;
 UPDATE public."Lead" SET stage='VISIT_REQUESTED',"updatedAt"=now() WHERE id=v."leadId" AND stage NOT IN ('NEGOTIATION','PROPOSAL','WON','LOST');
 RETURN true;
END $$;

-- Retention across tenants for the scheduled job; callers cannot choose shorter windows that bypass review.
CREATE FUNCTION public.purge_journey_data(apply boolean) RETURNS TABLE (visits bigint, leads bigint, devices bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF apply THEN
  RETURN QUERY WITH
   v AS (DELETE FROM public."TourVisit" WHERE "createdAt"<now()-interval '90 days' RETURNING 1),
   l AS (DELETE FROM public."Lead" WHERE "updatedAt"<now()-interval '365 days' RETURNING 1),
   d AS (DELETE FROM public."LeadDevice" WHERE "lastUsedAt"<now()-interval '365 days' RETURNING 1)
  SELECT (SELECT count(*) FROM v),(SELECT count(*) FROM l),(SELECT count(*) FROM d);
 ELSE
  RETURN QUERY SELECT
   (SELECT count(*) FROM public."TourVisit" WHERE "createdAt"<now()-interval '90 days'),
   (SELECT count(*) FROM public."Lead" WHERE "updatedAt"<now()-interval '365 days'),
   (SELECT count(*) FROM public."LeadDevice" WHERE "lastUsedAt"<now()-interval '365 days');
 END IF;
END $$;

DO $$ DECLARE api_role text; BEGIN
 REVOKE ALL ON FUNCTION public.purge_journey_data(boolean) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.purge_journey_data(boolean) TO imobview_app;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE 'REVOKE ALL ON FUNCTION public.purge_journey_data(boolean) FROM '||quote_ident(api_role); END IF;
 END LOOP;
END $$;
