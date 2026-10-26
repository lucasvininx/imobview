-- Floor plans reuse the tour asset pipeline; kind decides validation and where an asset may be referenced.
ALTER TABLE "PanoramaAsset" ADD COLUMN "kind" VARCHAR(12) NOT NULL DEFAULT 'PANORAMA';
ALTER TABLE "PanoramaAsset" ADD CONSTRAINT panorama_asset_kind CHECK (kind IN ('PANORAMA','FLOOR_PLAN'));

-- Default annual effective rate shown in the public financing simulator (basis points: 1150 = 11,50% a.a.).
ALTER TABLE "Organization" ADD COLUMN "financingRateBps" INTEGER NOT NULL DEFAULT 1150;
ALTER TABLE "Organization" ADD CONSTRAINT organization_financing_rate CHECK ("financingRateBps" BETWEEN 100 AND 4000);

-- CreateTable
CREATE TABLE "FinancingSimulation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "visitId" UUID NOT NULL,
    "downPaymentCents" BIGINT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "system" VARCHAR(5) NOT NULL,
    "installmentCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancingSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancingSimulation_organizationId_createdAt_idx" ON "FinancingSimulation"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancingSimulation_visitId_idx" ON "FinancingSimulation"("visitId");

-- AddForeignKey
ALTER TABLE "FinancingSimulation" ADD CONSTRAINT "FinancingSimulation_visitId_organizationId_fkey" FOREIGN KEY ("visitId", "organizationId") REFERENCES "TourVisit"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancingSimulation" ADD CONSTRAINT financing_simulation_bounds CHECK ("downPaymentCents">=0 AND "termMonths" BETWEEN 12 AND 420 AND "rateBps" BETWEEN 100 AND 4000 AND system IN ('SAC','PRICE') AND "installmentCents">0);

ALTER TABLE "JourneyEvent" DROP CONSTRAINT event_bounds;
ALTER TABLE "JourneyEvent" ADD CONSTRAINT event_bounds CHECK ("durationMs" BETWEEN 0 AND 30000 AND sequence BETWEEN 1 AND 2500 AND kind IN ('START','SCENE','HEARTBEAT','EXIT','COMPLETE','CONTACT','SHARE','HOTSPOT','SIMULATE'));

DO $$ DECLARE api_role text; BEGIN
 ALTER TABLE public."FinancingSimulation" ENABLE ROW LEVEL SECURITY;
 CREATE POLICY tenant_read ON public."FinancingSimulation" FOR SELECT USING ("organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="FinancingSimulation"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER')));
 CREATE POLICY tenant_write ON public."FinancingSimulation" FOR ALL USING ("organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="FinancingSimulation"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER'))) WITH CHECK ("organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="FinancingSimulation"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN','MEMBER')));
 REVOKE ALL ON public."FinancingSimulation" FROM PUBLIC;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public."FinancingSimulation" TO imobview_app;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON public."FinancingSimulation" FROM %I',api_role); END IF;
 END LOOP;
END $$;

-- Published floor plans must be readable on the public page, like panoramas.
CREATE OR REPLACE FUNCTION public.get_published_tours(requested_slug text)
RETURNS TABLE (id uuid, title text, document jsonb, assets jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT t.id,COALESCE(t.published->>'title',t.title)::text,t.published,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'storageKey',a."storageKey")) FROM public."PanoramaAsset" a WHERE a."tourId"=t.id AND a."organizationId"=t."organizationId" AND a.status='READY' AND (
   (a.kind='PANORAMA' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.published->'scenes') scene WHERE scene->>'assetId'=a.id::text))
   OR (a.kind='FLOOR_PLAN' AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(t.published->'floorPlans','[]'::jsonb)) plan WHERE plan->>'assetId'=a.id::text)))),'[]'::jsonb)
 FROM public."Tour" t JOIN public."Property" p ON p.id=t."propertyId" AND p."organizationId"=t."organizationId"
 WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL AND t.status='PUBLISHED' AND t.published IS NOT NULL ORDER BY t."createdAt" LIMIT 10;
$$;

CREATE FUNCTION public.get_financing_settings(requested_slug text) RETURNS TABLE (purpose text, "priceCents" bigint, "financingRateBps" integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p.purpose::text,p."priceCents",o."financingRateBps" FROM public."Property" p JOIN public."Organization" o ON o.id=p."organizationId"
 WHERE p.slug=requested_slug AND p.status='PUBLISHED' AND p."archivedAt" IS NULL LIMIT 1;
$$;

-- Adds SIMULATE: the installment is computed here from the stored price, never trusted from the browser.
CREATE OR REPLACE FUNCTION public.record_tour_event(token_hash text, payload jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public."TourVisit"; seq integer:=(payload->>'sequence')::integer; scene uuid:=(payload->>'sceneId')::uuid; event_kind text:=payload->>'kind'; elapsed integer;
 price bigint; down bigint; months integer; rate integer; sim_system text; financed numeric; monthly numeric; installment numeric;
BEGIN
 SELECT * INTO v FROM public."TourVisit" WHERE "tokenHash"=token_hash AND "expiresAt">now() FOR UPDATE;
 IF v.id IS NULL OR NOT v.tracking OR v."endedAt" IS NOT NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."Property" p JOIN public."Tour" t ON t."propertyId"=p.id AND t."organizationId"=p."organizationId" WHERE p.id=v."propertyId" AND p.status='PUBLISHED' AND t.id=v."tourId" AND t.status='PUBLISHED') THEN RETURN false; END IF;
 IF seq<=v."lastSequence" THEN RETURN true; END IF;
 IF seq<>v."lastSequence"+1 OR seq>2500 THEN RETURN false; END IF;
 IF scene IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.scenes) s WHERE s->>'id'=scene::text) THEN RETURN false; END IF;
 IF event_kind IN ('SCENE','HEARTBEAT','HOTSPOT') AND scene IS NULL THEN RETURN false; END IF;
 IF event_kind='COMPLETE' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.scenes) s WHERE NOT EXISTS(SELECT 1 FROM public."JourneyEvent" e WHERE e."visitId"=v.id AND e.kind='SCENE' AND e."sceneId"::text=s->>'id')) THEN RETURN false; END IF;
 IF event_kind='SIMULATE' THEN
  SELECT p."priceCents" INTO price FROM public."Property" p WHERE p.id=v."propertyId" AND p.purpose='SALE';
  down:=(payload->'simulation'->>'downPaymentCents')::bigint; months:=(payload->'simulation'->>'termMonths')::integer;
  rate:=(payload->'simulation'->>'rateBps')::integer; sim_system:=payload->'simulation'->>'system';
  IF price IS NULL OR price<=0 OR down IS NULL OR down<0 OR down>=price OR months NOT BETWEEN 12 AND 420 OR rate NOT BETWEEN 100 AND 4000 OR sim_system NOT IN ('SAC','PRICE') THEN RETURN false; END IF;
 END IF;
 elapsed:=CASE WHEN event_kind IN ('HEARTBEAT','EXIT') AND v."startedAt" IS NOT NULL THEN greatest(0,least((payload->>'durationMs')::integer,30000,(extract(epoch from now()-v."lastSeenAt")*1000)::integer)) ELSE 0 END;
 INSERT INTO public."JourneyEvent"(id,"organizationId","visitId",sequence,kind,"sceneId","durationMs") VALUES(gen_random_uuid(),v."organizationId",v.id,seq,event_kind,scene,elapsed);
 -- Keep at most 20 detailed simulations per visit; later ones still count as events so the sequence advances.
 IF event_kind='SIMULATE' AND (SELECT count(*) FROM public."FinancingSimulation" WHERE "visitId"=v.id)<20 THEN
  financed:=price-down;
  monthly:=power(1+rate/10000.0,1.0/12)-1;
  installment:=CASE WHEN sim_system='SAC' THEN financed/months+financed*monthly ELSE financed*monthly/(1-power(1+monthly,-months)) END;
  INSERT INTO public."FinancingSimulation"(id,"organizationId","visitId","downPaymentCents","termMonths","rateBps",system,"installmentCents") VALUES(gen_random_uuid(),v."organizationId",v.id,down,months,rate,sim_system,greatest(1,round(installment)::bigint));
 END IF;
 UPDATE public."TourVisit" SET "lastSequence"=seq,"lastSeenAt"=now(),"startedAt"=CASE WHEN event_kind='START' THEN coalesce("startedAt",now()) ELSE "startedAt" END,"endedAt"=CASE WHEN event_kind='EXIT' THEN now() ELSE NULL END,"completedAt"=CASE WHEN event_kind='COMPLETE' THEN coalesce("completedAt",now()) ELSE "completedAt" END WHERE id=v.id;
 IF event_kind='START' THEN UPDATE public."Lead" SET stage='TOUR_STARTED',"updatedAt"=now() WHERE id=v."leadId" AND stage='NEW'; END IF;
 IF event_kind='COMPLETE' THEN UPDATE public."Lead" SET stage='TOUR_COMPLETED',"updatedAt"=now() WHERE id=v."leadId" AND stage IN ('NEW','TOUR_STARTED'); END IF;
 RETURN true;
END $$;

DO $$ DECLARE api_role text; BEGIN
 REVOKE ALL ON FUNCTION public.get_financing_settings(text) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.get_financing_settings(text) TO imobview_app;
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE 'REVOKE ALL ON FUNCTION public.get_financing_settings(text) FROM '||quote_ident(api_role); END IF;
 END LOOP;
END $$;
