BEGIN;
ALTER TABLE "VisitRequest" ADD COLUMN "scheduledStartAt" timestamptz(3), ADD COLUMN "scheduledEndAt" timestamptz(3),
 ADD COLUMN "timeZone" varchar(80) NOT NULL DEFAULT 'America/Sao_Paulo', ADD COLUMN "calendarUserId" text,
 ADD COLUMN "calendarTargetId" text NOT NULL DEFAULT '', ADD COLUMN "scheduleRevision" integer NOT NULL DEFAULT 1,
 ADD COLUMN "calendarEventUrl" text NOT NULL DEFAULT '';
ALTER TABLE "VisitRequest" ADD CONSTRAINT visit_schedule_bounds CHECK (("scheduledStartAt" IS NULL AND "scheduledEndAt" IS NULL) OR ("scheduledStartAt" IS NOT NULL AND "scheduledEndAt" IS NOT NULL AND "scheduledEndAt">"scheduledStartAt" AND "scheduledEndAt"<="scheduledStartAt"+interval '4 hours'));
CREATE TABLE "OrganizationIntegration" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 provider varchar(20) NOT NULL CHECK(provider IN ('GOOGLE','WHATSAPP','EMAIL')), secret text NOT NULL,
 config jsonb NOT NULL DEFAULT '{}', enabled boolean NOT NULL DEFAULT false, "verifiedAt" timestamptz(3), "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
 UNIQUE("organizationId",provider)
);
CREATE TABLE "CalendarConnection" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE, secret text NOT NULL, "accountEmail" varchar(254) NOT NULL,
 "calendarId" varchar(1024) NOT NULL DEFAULT 'primary', "calendarName" varchar(240) NOT NULL DEFAULT 'Agenda principal',
 connected boolean NOT NULL DEFAULT true, "updatedAt" timestamptz(3) NOT NULL DEFAULT now(), UNIQUE("organizationId","userId")
);
CREATE TABLE "IntegrationDelivery" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "requestId" uuid NOT NULL, channel varchar(20) NOT NULL CHECK(channel IN ('CALENDAR','EMAIL_TEAM','EMAIL_CLIENT','WHATSAPP')),
 revision integer NOT NULL, payload jsonb NOT NULL DEFAULT '{}', state varchar(20) NOT NULL DEFAULT 'PENDING'
 CHECK(state IN ('PENDING','RUNNING','SUCCEEDED','ACCEPTED','DELIVERED','FAILED','SKIPPED','SUPERSEDED')),
 attempts integer NOT NULL DEFAULT 0, lease uuid, "availableAt" timestamptz(3) NOT NULL DEFAULT now(),
 "providerId" varchar(1024), "lastError" varchar(80), "createdAt" timestamptz(3) NOT NULL DEFAULT now(), "updatedAt" timestamptz(3) NOT NULL DEFAULT now(),
 UNIQUE("organizationId","requestId",channel,revision)
);
CREATE INDEX "IntegrationDelivery_state_availableAt_idx" ON "IntegrationDelivery"(state,"availableAt");
CREATE INDEX "IntegrationDelivery_organizationId_providerId_idx" ON "IntegrationDelivery"("organizationId","providerId");
CREATE TABLE "IntegrationReceipt" (
 "organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE, channel varchar(20) NOT NULL,
 "providerId" varchar(1024) NOT NULL, state varchar(20) NOT NULL CHECK(state IN ('DELIVERED','FAILED')),
 "occurredAt" timestamptz(3) NOT NULL, PRIMARY KEY("organizationId",channel,"providerId")
);
CREATE TABLE "CalendarEventBinding" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"organizationId" uuid NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
 "requestId" uuid NOT NULL,"userId" text NOT NULL,"calendarId" varchar(1024) NOT NULL,
 UNIQUE("organizationId","requestId","userId","calendarId")
);

DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['OrganizationIntegration','CalendarConnection','IntegrationDelivery','IntegrationReceipt','CalendarEventBinding'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO imobview_app',tbl);
  IF tbl='CalendarConnection' THEN
   EXECUTE format('CREATE POLICY calendar_owner ON public.%I FOR ALL USING ("organizationId"::text=current_setting(''app.organization_id'',true) AND "userId"=current_setting(''app.user_id'',true) AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="CalendarConnection"."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'',''MEMBER''))) WITH CHECK ("organizationId"::text=current_setting(''app.organization_id'',true) AND "userId"=current_setting(''app.user_id'',true) AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"="CalendarConnection"."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'',''MEMBER'')))',tbl);
  ELSE
   EXECUTE format('CREATE POLICY integration_read ON public.%I FOR SELECT USING ("organizationId"::text=current_setting(''app.organization_id'',true) AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=%I."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'',''MEMBER'')))',tbl,tbl);
   EXECUTE format('CREATE POLICY integration_manage ON public.%I FOR ALL USING ("organizationId"::text=current_setting(''app.organization_id'',true) AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=%I."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN''))) WITH CHECK ("organizationId"::text=current_setting(''app.organization_id'',true) AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=%I."organizationId" AND m."userId"=current_setting(''app.user_id'',true) AND m.role IN (''OWNER'',''ADMIN'')))',tbl,tbl,tbl);
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.visit_schedule_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.status,NEW."scheduledStartAt",NEW."scheduledEndAt",NEW."timeZone",NEW."calendarUserId",NEW."calendarTargetId") IS DISTINCT FROM (OLD.status,OLD."scheduledStartAt",OLD."scheduledEndAt",OLD."timeZone",OLD."calendarUserId",OLD."calendarTargetId") THEN
  NEW."scheduleRevision":=OLD."scheduleRevision"+1;
 ELSE IF TG_OP='UPDATE' THEN NEW."scheduleRevision":=OLD."scheduleRevision"; END IF; END IF;
 IF NEW."calendarUserId" IS NOT NULL AND (TG_OP='INSERT' OR NEW."calendarUserId" IS DISTINCT FROM OLD."calendarUserId") AND NOT EXISTS(SELECT 1 FROM public."CalendarConnection" c WHERE c."organizationId"=NEW."organizationId" AND c."userId"=NEW."calendarUserId" AND c.connected) THEN RAISE EXCEPTION 'Calendar connection unavailable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER visit_schedule_revision BEFORE INSERT OR UPDATE ON "VisitRequest" FOR EACH ROW EXECUTE FUNCTION public.visit_schedule_revision();

CREATE FUNCTION public.queue_visit_integrations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public."VisitRequest"; previous_user text; previous_target text; rev integer; data jsonb; mode text;
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM public."Organization" WHERE id=OLD."organizationId") THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW."scheduleRevision"=OLD."scheduleRevision" THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN r:=OLD; rev:=r."scheduleRevision"+1; mode:='DELETE'; ELSE r:=NEW; rev:=r."scheduleRevision"; mode:=CASE WHEN r.status='CANCELLED' THEN 'DELETE' ELSE 'UPSERT' END; END IF;
 IF TG_OP<>'INSERT' THEN previous_user:=OLD."calendarUserId"; previous_target:=OLD."calendarTargetId"; END IF;
 data:=jsonb_build_object('operation',mode,'userId',r."calendarUserId",'calendarId',r."calendarTargetId",'previousUserId',previous_user,'previousCalendarId',previous_target,
  'kind',CASE WHEN TG_OP='DELETE' OR r.status='CANCELLED' THEN 'CANCELLED' WHEN r.status='CONFIRMED' THEN CASE WHEN TG_OP='UPDATE' AND OLD.status='CONFIRMED' THEN 'RESCHEDULED' ELSE 'CONFIRMED' END ELSE 'REQUESTED' END);
 IF previous_user IS NOT NULL OR (r."calendarUserId" IS NOT NULL AND r."scheduledStartAt" IS NOT NULL) THEN
  INSERT INTO public."IntegrationDelivery"("organizationId","requestId",channel,revision,payload) VALUES(r."organizationId",r.id,'CALENDAR',rev,data) ON CONFLICT DO NOTHING;
 END IF;
 IF TG_OP<>'DELETE' THEN
  IF EXISTS(SELECT 1 FROM public."OrganizationIntegration" i WHERE i."organizationId"=r."organizationId" AND i.provider='EMAIL' AND i.enabled) THEN
   IF coalesce((SELECT (config->>'notifyTeam')::boolean FROM public."OrganizationIntegration" WHERE "organizationId"=r."organizationId" AND provider='EMAIL'),true) THEN
    INSERT INTO public."IntegrationDelivery"("organizationId","requestId",channel,revision,payload) VALUES(r."organizationId",r.id,'EMAIL_TEAM',rev,data) ON CONFLICT DO NOTHING;
   END IF;
   IF r."scheduledStartAt" IS NOT NULL AND r.status IN ('CONFIRMED','CANCELLED') AND coalesce((SELECT (config->>'notifyClient')::boolean FROM public."OrganizationIntegration" WHERE "organizationId"=r."organizationId" AND provider='EMAIL'),false) THEN
    INSERT INTO public."IntegrationDelivery"("organizationId","requestId",channel,revision,payload) VALUES(r."organizationId",r.id,'EMAIL_CLIENT',rev,data) ON CONFLICT DO NOTHING;
   END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public."OrganizationIntegration" i JOIN public."Organization" o ON o.id=i."organizationId" WHERE i."organizationId"=r."organizationId" AND i.provider='WHATSAPP' AND i.enabled AND o."whatsappVisitAlerts") THEN
   INSERT INTO public."IntegrationDelivery"("organizationId","requestId",channel,revision,payload) VALUES(r."organizationId",r.id,'WHATSAPP',rev,data) ON CONFLICT DO NOTHING;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER visit_integrations AFTER INSERT OR UPDATE OR DELETE ON "VisitRequest" FOR EACH ROW EXECUTE FUNCTION public.queue_visit_integrations();

CREATE FUNCTION public.claim_integration_deliveries(org uuid DEFAULT NULL, request_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,lease uuid,data jsonb) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public."IntegrationDelivery" d SET state='SUPERSEDED',lease=NULL WHERE (d.state='PENDING' OR (d.state='RUNNING' AND d."availableAt"<=now())) AND (org IS NULL OR d."organizationId"=org)
 AND EXISTS(SELECT 1 FROM public."IntegrationDelivery" newer WHERE newer."organizationId"=d."organizationId" AND newer."requestId"=d."requestId" AND newer.channel=d.channel AND newer.revision>d.revision);
 -- A crashed sender may have submitted a message before persisting its response.
 -- Calendar writes are deterministic; messages require manual reconciliation.
 UPDATE public."IntegrationDelivery" d SET state='FAILED',lease=NULL,"updatedAt"=now(),
 "lastError"=CASE WHEN d.channel='CALENDAR' THEN 'RETRY_EXHAUSTED' ELSE 'DELIVERY_UNKNOWN' END
 WHERE d.state='RUNNING' AND d."availableAt"<=now() AND (d.channel<>'CALENDAR' OR d.attempts>=6)
 AND (org IS NULL OR d."organizationId"=org) AND (request_id IS NULL OR d."requestId"=request_id);
 RETURN QUERY WITH candidates AS (
 SELECT d.id FROM public."IntegrationDelivery" d WHERE (org IS NULL OR d."organizationId"=org) AND (request_id IS NULL OR d."requestId"=request_id)
 AND d.state IN ('PENDING','RUNNING') AND d.attempts<6 AND d."availableAt"<=now()
 AND NOT EXISTS(SELECT 1 FROM public."IntegrationDelivery" busy WHERE busy."requestId"=d."requestId" AND busy.channel=d.channel AND busy.state='RUNNING' AND busy."availableAt">now())
 ORDER BY d."createdAt" LIMIT 10 FOR UPDATE SKIP LOCKED
 ), claimed AS (
 UPDATE public."IntegrationDelivery" d SET state='RUNNING',lease=gen_random_uuid(),attempts=attempts+1,"availableAt"=now()+interval '2 minutes',"updatedAt"=now()
 FROM candidates c WHERE d.id=c.id RETURNING d.*
 ), bindings AS (
 INSERT INTO public."CalendarEventBinding"("organizationId","requestId","userId","calendarId")
 SELECT j."organizationId",j."requestId",j.payload->>'userId',j.payload->>'calendarId' FROM claimed j
 JOIN public."VisitRequest" r ON r.id=j."requestId" AND r."organizationId"=j."organizationId"
 WHERE j.channel='CALENDAR' AND j.payload->>'operation'='UPSERT' AND r.status='CONFIRMED' AND j.payload->>'userId' IS NOT NULL
 ON CONFLICT DO NOTHING RETURNING *
 ) SELECT j.id,j.lease,jsonb_build_object('organizationId',j."organizationId",'requestId',j."requestId",'channel',j.channel,'revision',j.revision,'payload',j.payload,
  'request',to_jsonb(r),'lead',jsonb_build_object('name',l.name,'email',l.email,'phone',l.phone),
  'property',jsonb_build_object('title',p.title,'slug',p.slug,'address',p.address,'city',p.city),
  'organization',jsonb_build_object('name',o.name,'email',o."contactEmail",'phone',o.whatsapp,'whatsappAlerts',o."whatsappVisitAlerts"),
  'broker',jsonb_build_object('email',b.email,'phone',b.phone),
  'integration',to_jsonb(i),'calendar',to_jsonb(c),'previousCalendar',to_jsonb(previous),
  'bindings',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',binding."userId",'calendarId',binding."calendarId",'secret',bc.secret,'connected',bc.connected AND EXISTS(SELECT 1 FROM public."OrganizationMember" bm WHERE bm."organizationId"=bc."organizationId" AND bm."userId"=bc."userId")))
   FROM public."CalendarEventBinding" binding LEFT JOIN public."CalendarConnection" bc ON bc."organizationId"=binding."organizationId" AND bc."userId"=binding."userId"
   WHERE binding."organizationId"=j."organizationId" AND binding."requestId"=j."requestId"),'[]'::jsonb))
 FROM claimed j LEFT JOIN public."VisitRequest" r ON r.id=j."requestId" AND r."organizationId"=j."organizationId"
 LEFT JOIN public."Lead" l ON l.id=r."leadId" AND l."organizationId"=j."organizationId"
 LEFT JOIN public."Property" p ON p.id=l."propertyId" AND p."organizationId"=j."organizationId"
 LEFT JOIN public."Broker" b ON b.id=l."brokerId" AND b."organizationId"=j."organizationId" AND b.active
 JOIN public."Organization" o ON o.id=j."organizationId"
 LEFT JOIN public."OrganizationIntegration" i ON i."organizationId"=j."organizationId" AND i.provider=CASE WHEN j.channel='CALENDAR' THEN 'GOOGLE' WHEN j.channel='WHATSAPP' THEN 'WHATSAPP' ELSE 'EMAIL' END
 LEFT JOIN public."CalendarConnection" c ON c."organizationId"=j."organizationId" AND c."userId"=j.payload->>'userId' AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=c."organizationId" AND m."userId"=c."userId")
 LEFT JOIN public."CalendarConnection" previous ON previous."organizationId"=j."organizationId" AND previous."userId"=j.payload->>'previousUserId' AND EXISTS(SELECT 1 FROM public."OrganizationMember" m WHERE m."organizationId"=previous."organizationId" AND m."userId"=previous."userId");
END $$;

CREATE FUNCTION public.finish_integration_delivery(job_id uuid,job_lease uuid,result jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public."IntegrationDelivery"; receipt public."IntegrationReceipt";
BEGIN
 SELECT * INTO j FROM public."IntegrationDelivery" WHERE id=job_id AND lease=job_lease FOR UPDATE;
 IF j.id IS NULL THEN RETURN; END IF;
 SELECT * INTO receipt FROM public."IntegrationReceipt" WHERE "organizationId"=j."organizationId" AND channel=CASE WHEN j.channel LIKE 'EMAIL%' THEN 'EMAIL' ELSE j.channel END AND "providerId"=result->>'providerId';
 UPDATE public."IntegrationDelivery" SET state=coalesce(receipt.state,CASE WHEN result->>'state'='PENDING' AND attempts>=6 THEN 'FAILED' ELSE result->>'state' END),
  "providerId"=coalesce(result->>'providerId',"providerId"),"lastError"=CASE WHEN receipt.state='FAILED' THEN 'PROVIDER_DELIVERY_FAILED' ELSE left(result->>'error',80) END,lease=NULL,
  "availableAt"=now()+make_interval(secs=>least(86400,60*power(2,attempts)::integer)),"updatedAt"=now() WHERE id=j.id;
 IF result->>'url' IS NOT NULL THEN UPDATE public."VisitRequest" SET "calendarEventUrl"=result->>'url' WHERE id=j."requestId" AND "organizationId"=j."organizationId" AND "scheduleRevision"=j.revision; END IF;
END $$;
CREATE FUNCTION public.clear_calendar_binding(job_id uuid,job_lease uuid,owner_id text,calendar_id text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 DELETE FROM public."CalendarEventBinding" b USING public."IntegrationDelivery" j WHERE j.id=job_id AND j.lease=job_lease AND j.channel='CALENDAR' AND j.state='RUNNING'
 AND b."organizationId"=j."organizationId" AND b."requestId"=j."requestId" AND b."userId"=owner_id AND b."calendarId"=calendar_id;
$$;
CREATE FUNCTION public.integration_webhook_secret(org uuid,provider_name text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT secret FROM public."OrganizationIntegration" WHERE "organizationId"=org AND provider=provider_name AND enabled;
$$;
CREATE FUNCTION public.integration_receipt(org uuid,provider_name text,message_id text,message_state text,occurred_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF provider_name NOT IN ('WHATSAPP','EMAIL') OR message_state NOT IN ('DELIVERED','FAILED') OR length(message_id)>1024 THEN RETURN; END IF;
 INSERT INTO public."IntegrationReceipt" VALUES(org,provider_name,message_id,message_state,occurred_at)
 ON CONFLICT("organizationId",channel,"providerId") DO UPDATE SET state=EXCLUDED.state,"occurredAt"=EXCLUDED."occurredAt" WHERE EXCLUDED."occurredAt">="IntegrationReceipt"."occurredAt";
 UPDATE public."IntegrationDelivery" d SET state=r.state,"lastError"=CASE WHEN r.state='FAILED' THEN 'PROVIDER_DELIVERY_FAILED' ELSE NULL END,"updatedAt"=now()
 FROM public."IntegrationReceipt" r WHERE d."organizationId"=org AND d."providerId"=message_id AND r."organizationId"=org AND r.channel=provider_name AND r."providerId"=message_id AND (d.channel=provider_name OR (provider_name='EMAIL' AND d.channel LIKE 'EMAIL%'));
END $$;

-- New tenant-owned WhatsApp credentials take precedence over the legacy platform sender.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_deliveries(visit_token_hash text DEFAULT NULL)
RETURNS TABLE(id uuid,lease uuid,phone text,kind text,name text,property text,date text,period text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH candidates AS (
 SELECT d.id FROM public."WhatsAppDelivery" d JOIN public."Organization" o ON o.id=d."organizationId" JOIN public."VisitRequest" r ON r.id=d."requestId"
 WHERE d."sentAt" IS NULL AND d.attempts<5 AND d."availableAt"<=now() AND o."whatsappVisitAlerts" AND r.status<>'CANCELLED'
 AND NOT EXISTS(SELECT 1 FROM public."OrganizationIntegration" i WHERE i."organizationId"=d."organizationId" AND i.provider='WHATSAPP' AND i.enabled)
 AND (visit_token_hash IS NULL OR EXISTS(SELECT 1 FROM public."TourVisit" v WHERE v."tokenHash"=visit_token_hash AND v."leadId"=r."leadId" AND v."expiresAt">now()))
 ORDER BY d."createdAt" LIMIT 10 FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (UPDATE public."WhatsAppDelivery" d SET lease=gen_random_uuid(),attempts=attempts+1,"availableAt"=now()+interval '5 minutes' FROM candidates c WHERE d.id=c.id RETURNING d.*)
 SELECT c.id,c.lease,c.phone::text,c.kind::text,l.name::text,p.title::text,r."preferredDate"::text,r.period::text FROM claimed c
 JOIN public."VisitRequest" r ON r.id=c."requestId" JOIN public."Lead" l ON l.id=r."leadId" AND l."organizationId"=r."organizationId"
 JOIN public."Property" p ON p.id=l."propertyId" AND p."organizationId"=l."organizationId";
$$;
DO $$ DECLARE fn text; role_name text; tbl text; BEGIN
 FOREACH fn IN ARRAY ARRAY['visit_schedule_revision()','queue_visit_integrations()','claim_integration_deliveries(uuid,uuid)','finish_integration_delivery(uuid,uuid,jsonb)','clear_calendar_binding(uuid,uuid,text,text)','integration_webhook_secret(uuid,text)','integration_receipt(uuid,text,text,text,timestamp with time zone)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM PUBLIC,imobview_app';
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM '||quote_ident(role_name); END IF;
  END LOOP;
 END LOOP;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   FOREACH tbl IN ARRAY ARRAY['OrganizationIntegration','CalendarConnection','IntegrationDelivery','IntegrationReceipt','CalendarEventBinding'] LOOP EXECUTE format('REVOKE ALL ON public.%I FROM %I',tbl,role_name); END LOOP;
  END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_integration_deliveries(uuid,uuid),public.finish_integration_delivery(uuid,uuid,jsonb),public.integration_webhook_secret(uuid,text),public.integration_receipt(uuid,text,text,text,timestamptz) TO imobview_app;
GRANT EXECUTE ON FUNCTION public.clear_calendar_binding(uuid,uuid,text,text) TO imobview_app;

CREATE FUNCTION public.integration_settings_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.provider='GOOGLE' AND NEW.config->>'credentialVersion' IS DISTINCT FROM OLD.config->>'credentialVersion' THEN UPDATE public."CalendarConnection" SET connected=false WHERE "organizationId"=NEW."organizationId"; END IF;
 IF NEW.provider='WHATSAPP' AND NEW.enabled THEN UPDATE public."WhatsAppDelivery" SET attempts=5,"lastError"='REPLACED_BY_TENANT_INTEGRATION' WHERE "organizationId"=NEW."organizationId" AND "sentAt" IS NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER integration_settings_changed AFTER INSERT OR UPDATE ON "OrganizationIntegration" FOR EACH ROW EXECUTE FUNCTION public.integration_settings_changed();
CREATE FUNCTION public.integration_legacy_whatsapp_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."OrganizationIntegration" WHERE "organizationId"=NEW."organizationId" AND provider='WHATSAPP' AND enabled) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER integration_legacy_whatsapp_guard BEFORE INSERT ON "WhatsAppDelivery" FOR EACH ROW EXECUTE FUNCTION public.integration_legacy_whatsapp_guard();
REVOKE ALL ON FUNCTION public.integration_settings_changed(),public.integration_legacy_whatsapp_guard() FROM PUBLIC,imobview_app;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON FUNCTION public.integration_settings_changed(),public.integration_legacy_whatsapp_guard() FROM %I',api_role); END IF;
 END LOOP;
END $$;
COMMIT;
