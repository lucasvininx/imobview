-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "address" VARCHAR(240) NOT NULL DEFAULT '',
ADD COLUMN     "brokerId" UUID,
ADD COLUMN     "captureLeads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commercialNotes" VARCHAR(2000) NOT NULL DEFAULT '',
ADD COLUMN     "condominium" VARCHAR(160) NOT NULL DEFAULT '',
ADD COLUMN     "internalCode" VARCHAR(80) NOT NULL DEFAULT '',
ADD COLUMN     "suites" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Broker" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "stage" VARCHAR(30) NOT NULL DEFAULT 'NEW',
    "notes" VARCHAR(5000) NOT NULL DEFAULT '',
    "source" VARCHAR(120) NOT NULL DEFAULT 'direct',
    "consentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentVersion" TEXT NOT NULL DEFAULT 'journey-v1',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "proposalAt" TIMESTAMPTZ(3),
    "wonAt" TIMESTAMPTZ(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourVisit" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "leadId" UUID,
    "tokenHash" VARCHAR(64) NOT NULL,
    "abuseKey" VARCHAR(64) NOT NULL,
    "source" VARCHAR(120) NOT NULL,
    "tracking" BOOLEAN NOT NULL,
    "scenes" JSONB NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TourVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "visitId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "sceneId" UUID,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "preferredDate" VARCHAR(10) NOT NULL,
    "period" VARCHAR(15) NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VisitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broker_organizationId_active_idx" ON "Broker"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Broker_id_organizationId_key" ON "Broker"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_createdAt_idx" ON "Lead"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_organizationId_propertyId_stage_idx" ON "Lead"("organizationId", "propertyId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_id_organizationId_key" ON "Lead"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TourVisit_tokenHash_key" ON "TourVisit"("tokenHash");

-- CreateIndex
CREATE INDEX "TourVisit_organizationId_propertyId_createdAt_idx" ON "TourVisit"("organizationId", "propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "TourVisit_abuseKey_createdAt_idx" ON "TourVisit"("abuseKey", "createdAt");

-- CreateIndex
CREATE INDEX "TourVisit_leadId_idx" ON "TourVisit"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "TourVisit_id_organizationId_key" ON "TourVisit"("id", "organizationId");

-- CreateIndex
CREATE INDEX "JourneyEvent_organizationId_createdAt_idx" ON "JourneyEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyEvent_visitId_sequence_key" ON "JourneyEvent"("visitId", "sequence");

-- CreateIndex
CREATE INDEX "VisitRequest_organizationId_status_preferredDate_idx" ON "VisitRequest"("organizationId", "status", "preferredDate");

-- CreateIndex
CREATE UNIQUE INDEX "VisitRequest_leadId_preferredDate_period_key" ON "VisitRequest"("leadId", "preferredDate", "period");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_brokerId_organizationId_fkey" FOREIGN KEY ("brokerId", "organizationId") REFERENCES "Broker"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broker" ADD CONSTRAINT "Broker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourVisit" ADD CONSTRAINT "TourVisit_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourVisit" ADD CONSTRAINT "TourVisit_leadId_organizationId_fkey" FOREIGN KEY ("leadId", "organizationId") REFERENCES "Lead"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyEvent" ADD CONSTRAINT "JourneyEvent_visitId_organizationId_fkey" FOREIGN KEY ("visitId", "organizationId") REFERENCES "TourVisit"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_leadId_organizationId_fkey" FOREIGN KEY ("leadId", "organizationId") REFERENCES "Lead"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TourVisit" ADD CONSTRAINT visit_tour_tenant FOREIGN KEY ("tourId","organizationId") REFERENCES "Tour"(id,"organizationId") ON DELETE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT lead_stage CHECK (stage IN ('NEW','TOUR_STARTED','TOUR_COMPLETED','INTERESTED','VISIT_REQUESTED','NEGOTIATION','PROPOSAL','WON','LOST'));
ALTER TABLE "VisitRequest" ADD CONSTRAINT request_state CHECK (status IN ('REQUESTED','CONFIRMED','CANCELLED') AND period IN ('MORNING','AFTERNOON','EVENING'));
ALTER TABLE "JourneyEvent" ADD CONSTRAINT event_bounds CHECK ("durationMs" BETWEEN 0 AND 30000 AND sequence BETWEEN 1 AND 2500 AND kind IN ('START','SCENE','HEARTBEAT','EXIT','COMPLETE','CONTACT','SHARE','HOTSPOT'));
ALTER TABLE "Property" ADD CONSTRAINT property_suites CHECK (suites BETWEEN 0 AND 100);

DO $$ DECLARE tab text; api_role text; BEGIN
 FOREACH tab IN ARRAY ARRAY['Broker','Lead','TourVisit','JourneyEvent','VisitRequest'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT USING ("organizationId"::text=current_setting(''app.organization_id'',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=%I."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'',''MEMBER'')))',tab,tab);
  EXECUTE format('CREATE POLICY tenant_write ON public.%I FOR ALL USING ("organizationId"::text=current_setting(''app.organization_id'',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=%I."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'',''MEMBER''))) WITH CHECK ("organizationId"::text=current_setting(''app.organization_id'',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=%I."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'',''MEMBER'')))',tab,tab,tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO imobview_app',tab);
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON public.%I FROM %I',tab,api_role); END IF;
  END LOOP;
 END LOOP;
END $$;

CREATE FUNCTION public.get_journey_settings(requested_slug text) RETURNS TABLE ("captureLeads" boolean, "internalCode" text, condominium text, suites integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p."captureLeads",p."internalCode"::text,p.condominium::text,p.suites FROM public."Property" p WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL;
$$;

-- These capabilities resolve their tenant from a published tour; callers never supply a tenant id.
CREATE FUNCTION public.begin_tour_visit(payload jsonb, token_hash text, abuse_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public."Property"; t public."Tour"; visit_id uuid:=gen_random_uuid(); lead_id uuid; tracking boolean;
BEGIN
 IF token_hash !~ '^[a-f0-9]{64}$' OR abuse_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid capability'; END IF;
 SELECT * INTO p FROM public."Property" WHERE slug=payload->>'slug' AND status='PUBLISHED' AND "archivedAt" IS NULL;
 SELECT * INTO t FROM public."Tour" WHERE id=(payload->>'tourId')::uuid AND "propertyId"=p.id AND "organizationId"=p."organizationId" AND status='PUBLISHED' AND published IS NOT NULL;
 IF t.id IS NULL OR jsonb_array_length(t.published->'scenes')=0 THEN RAISE EXCEPTION 'unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(abuse_key,0));
 IF (SELECT count(*) FROM public."TourVisit" WHERE "abuseKey"=abuse_key AND "createdAt">now()-interval '1 hour')>=40 THEN RAISE EXCEPTION 'rate limit'; END IF;
 PERFORM 1 FROM public."Organization" WHERE id=p."organizationId" FOR UPDATE;
 IF (SELECT count(*) FROM public."TourVisit" WHERE "organizationId"=p."organizationId" AND "createdAt">now()-interval '1 day')>=5000 THEN RAISE EXCEPTION 'capacity'; END IF;
 tracking:=(payload->>'tracking')::boolean;
 IF payload ? 'contact' THEN
  IF (payload->'contact'->>'consent') IS DISTINCT FROM 'true' OR length(payload->'contact'->>'name') NOT BETWEEN 3 AND 160 OR length(payload->'contact'->>'email') NOT BETWEEN 3 AND 254 OR (payload->'contact'->>'phone') !~ '^[0-9]{10,15}$' THEN RAISE EXCEPTION 'invalid contact'; END IF;
  lead_id:=gen_random_uuid();
  INSERT INTO public."Lead"(id,"organizationId","propertyId",name,email,phone,source,"updatedAt") VALUES(lead_id,p."organizationId",p.id,payload->'contact'->>'name',payload->'contact'->>'email',payload->'contact'->>'phone',left(coalesce(payload->>'source','direct'),120),now());
 ELSIF NOT tracking THEN RAISE EXCEPTION 'consent required'; END IF;
 INSERT INTO public."TourVisit"(id,"organizationId","propertyId","tourId","leadId","tokenHash","abuseKey",source,tracking,scenes,"expiresAt") VALUES(visit_id,p."organizationId",p.id,t.id,lead_id,token_hash,abuse_key,left(coalesce(payload->>'source','direct'),120),tracking,(SELECT jsonb_agg(jsonb_build_object('id',s->>'id','title',s->>'title')) FROM jsonb_array_elements(t.published->'scenes') s),now()+interval '24 hours');
 RETURN visit_id;
END $$;

CREATE FUNCTION public.record_tour_event(token_hash text, payload jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public."TourVisit"; seq integer:=(payload->>'sequence')::integer; scene uuid:=(payload->>'sceneId')::uuid; event_kind text:=payload->>'kind'; elapsed integer;
BEGIN
 SELECT * INTO v FROM public."TourVisit" WHERE "tokenHash"=token_hash AND "expiresAt">now() FOR UPDATE;
 IF v.id IS NULL OR NOT v.tracking OR v."endedAt" IS NOT NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."Property" p JOIN public."Tour" t ON t."propertyId"=p.id AND t."organizationId"=p."organizationId" WHERE p.id=v."propertyId" AND p.status='PUBLISHED' AND t.id=v."tourId" AND t.status='PUBLISHED') THEN RETURN false; END IF;
 IF seq<=v."lastSequence" THEN RETURN true; END IF;
 IF seq<>v."lastSequence"+1 OR seq>2500 THEN RETURN false; END IF;
 IF scene IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.scenes) s WHERE s->>'id'=scene::text) THEN RETURN false; END IF;
 IF event_kind IN ('SCENE','HEARTBEAT','HOTSPOT') AND scene IS NULL THEN RETURN false; END IF;
 IF event_kind='COMPLETE' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.scenes) s WHERE NOT EXISTS(SELECT 1 FROM public."JourneyEvent" e WHERE e."visitId"=v.id AND e.kind='SCENE' AND e."sceneId"::text=s->>'id')) THEN RETURN false; END IF;
 elapsed:=CASE WHEN event_kind IN ('HEARTBEAT','EXIT') AND v."startedAt" IS NOT NULL THEN greatest(0,least((payload->>'durationMs')::integer,30000,(extract(epoch from now()-v."lastSeenAt")*1000)::integer)) ELSE 0 END;
 INSERT INTO public."JourneyEvent"(id,"organizationId","visitId",sequence,kind,"sceneId","durationMs") VALUES(gen_random_uuid(),v."organizationId",v.id,seq,event_kind,scene,elapsed);
 UPDATE public."TourVisit" SET "lastSequence"=seq,"lastSeenAt"=now(),"startedAt"=CASE WHEN event_kind='START' THEN coalesce("startedAt",now()) ELSE "startedAt" END,"endedAt"=CASE WHEN event_kind='EXIT' THEN now() ELSE NULL END,"completedAt"=CASE WHEN event_kind='COMPLETE' THEN coalesce("completedAt",now()) ELSE "completedAt" END WHERE id=v.id;
 IF event_kind='START' THEN UPDATE public."Lead" SET stage='TOUR_STARTED',"updatedAt"=now() WHERE id=v."leadId" AND stage='NEW'; END IF;
 IF event_kind='COMPLETE' THEN UPDATE public."Lead" SET stage='TOUR_COMPLETED',"updatedAt"=now() WHERE id=v."leadId" AND stage IN ('NEW','TOUR_STARTED'); END IF;
 RETURN true;
END $$;

CREATE FUNCTION public.request_property_visit(token_hash text, requested_date text, requested_period text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public."TourVisit";
BEGIN
 SELECT * INTO v FROM public."TourVisit" WHERE "tokenHash"=token_hash AND "expiresAt">now() FOR UPDATE;
 IF v.id IS NULL OR v."leadId" IS NULL OR requested_period NOT IN ('MORNING','AFTERNOON','EVENING') OR requested_date::date<current_date OR requested_date::date>current_date+180 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."Property" WHERE id=v."propertyId" AND status='PUBLISHED') THEN RETURN false; END IF;
 IF (SELECT count(*) FROM public."VisitRequest" WHERE "leadId"=v."leadId")>=3 THEN RETURN false; END IF;
 INSERT INTO public."VisitRequest"(id,"organizationId","leadId","preferredDate",period,"updatedAt") VALUES(gen_random_uuid(),v."organizationId",v."leadId",requested_date,requested_period,now()) ON CONFLICT ("leadId","preferredDate",period) DO NOTHING;
 UPDATE public."Lead" SET stage='VISIT_REQUESTED',"updatedAt"=now() WHERE id=v."leadId" AND stage NOT IN ('NEGOTIATION','PROPOSAL','WON','LOST');
 RETURN true;
END $$;

DO $$ DECLARE fn text; api_role text; BEGIN
 FOREACH fn IN ARRAY ARRAY['get_journey_settings(text)','begin_tour_visit(jsonb,text,text)','record_tour_event(text,jsonb)','request_property_visit(text,text,text)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||fn||' TO imobview_app';
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM '||quote_ident(api_role); END IF;
  END LOOP;
 END LOOP;
END $$;
