BEGIN;

ALTER TABLE "Organization" ADD COLUMN "leadDistribution" VARCHAR(20) NOT NULL DEFAULT 'PROPERTY',
 ADD COLUMN "whatsappVisitAlerts" BOOLEAN NOT NULL DEFAULT false,
 ADD CONSTRAINT distribution_mode CHECK ("leadDistribution" IN ('PROPERTY','ROUND_ROBIN','PERFORMANCE'));
ALTER TABLE "Broker" ADD COLUMN "lastLeadAt" TIMESTAMPTZ(3), ADD COLUMN "leadCredit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "brokerId" UUID,
 ADD CONSTRAINT "Lead_brokerId_organizationId_fkey" FOREIGN KEY ("brokerId","organizationId") REFERENCES "Broker"(id,"organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE INDEX "Lead_organizationId_brokerId_wonAt_idx" ON "Lead"("organizationId","brokerId","wonAt");
UPDATE "Lead" l SET "brokerId"=p."brokerId" FROM "Property" p WHERE p.id=l."propertyId" AND p."organizationId"=l."organizationId";
UPDATE "Property" SET "captureLeads"=true;
ALTER TABLE "Property" ALTER COLUMN "captureLeads" SET DEFAULT true;

CREATE TABLE "Notification" (
 id UUID PRIMARY KEY, "organizationId" UUID NOT NULL, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "leadId" UUID NOT NULL, kind VARCHAR(30) NOT NULL, title VARCHAR(160) NOT NULL, message VARCHAR(500) NOT NULL,
 "readAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
 FOREIGN KEY ("leadId","organizationId") REFERENCES "Lead"(id,"organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_organizationId_userId_readAt_createdAt_idx" ON "Notification"("organizationId","userId","readAt","createdAt");
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_notifications ON "Notification" FOR ALL
 USING ("organizationId"::text=current_setting('app.organization_id',true) AND "userId"=current_setting('app.user_id',true)
 AND EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="Notification"."organizationId" AND m."userId"="Notification"."userId" AND m.role IN ('OWNER','ADMIN','MEMBER')))
 WITH CHECK ("organizationId"::text=current_setting('app.organization_id',true) AND "userId"=current_setting('app.user_id',true));
GRANT SELECT,UPDATE ON "Notification" TO imobview_app;

CREATE TABLE "WhatsAppDelivery" (
 id UUID PRIMARY KEY, "organizationId" UUID NOT NULL, "requestId" UUID NOT NULL REFERENCES "VisitRequest"(id) ON DELETE CASCADE,
 kind VARCHAR(30) NOT NULL, phone VARCHAR(15) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), lease UUID, "sentAt" TIMESTAMPTZ(3), "lastError" VARCHAR(80),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(), UNIQUE ("requestId",kind)
);
CREATE INDEX "WhatsAppDelivery_sentAt_availableAt_idx" ON "WhatsAppDelivery"("sentAt","availableAt");
ALTER TABLE "WhatsAppDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_read ON "WhatsAppDelivery" FOR SELECT USING (
 "organizationId"::text=current_setting('app.organization_id',true) AND EXISTS (
 SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"="WhatsAppDelivery"."organizationId" AND m."userId"=current_setting('app.user_id',true) AND m.role IN ('OWNER','ADMIN')));
GRANT SELECT ON "WhatsAppDelivery" TO imobview_app;

-- Organization lock serializes assignments, including simultaneous public registrations.
CREATE FUNCTION public.assign_incoming_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE mode text; chosen uuid; total_weight integer;
BEGIN
 SELECT "leadDistribution" INTO mode FROM public."Organization" WHERE id=NEW."organizationId" FOR UPDATE;
 IF NEW."brokerId" IS NOT NULL THEN RETURN NEW; END IF;
 IF mode='PROPERTY' THEN
  SELECT b.id INTO chosen FROM public."Property" p JOIN public."Broker" b ON b.id=p."brokerId" AND b."organizationId"=p."organizationId"
   WHERE p.id=NEW."propertyId" AND p."organizationId"=NEW."organizationId" AND b.active;
 ELSIF mode='ROUND_ROBIN' THEN
  SELECT id INTO chosen FROM public."Broker" WHERE "organizationId"=NEW."organizationId" AND active ORDER BY "lastLeadAt" NULLS FIRST,"createdAt",id LIMIT 1;
 ELSE
  -- Smooth weighted round robin. Each active broker has weight 1 + wins in the last 90 days.
  WITH weights AS (
   SELECT b.id, 1+count(l.id)::integer AS weight FROM public."Broker" b
   LEFT JOIN public."Lead" l ON l."brokerId"=b.id AND l."organizationId"=b."organizationId" AND l.stage='WON' AND l."wonAt">now()-interval '90 days'
   WHERE b."organizationId"=NEW."organizationId" AND b.active GROUP BY b.id
  ), credited AS (
   UPDATE public."Broker" b SET "leadCredit"=b."leadCredit"+w.weight FROM weights w WHERE b.id=w.id RETURNING w.weight
  ) SELECT sum(weight) INTO total_weight FROM credited;
  SELECT id INTO chosen FROM public."Broker" WHERE "organizationId"=NEW."organizationId" AND active ORDER BY "leadCredit" DESC,"lastLeadAt" NULLS FIRST,id LIMIT 1;
  UPDATE public."Broker" SET "leadCredit"="leadCredit"-total_weight WHERE id=chosen;
 END IF;
 NEW."brokerId":=chosen;
 UPDATE public."Broker" SET "lastLeadAt"=clock_timestamp() WHERE id=chosen;
 RETURN NEW;
END $$;
CREATE TRIGGER assign_lead BEFORE INSERT ON "Lead" FOR EACH ROW EXECUTE FUNCTION public.assign_incoming_lead();

CREATE FUNCTION public.notify_lead_team(lead_id uuid, event_kind text, event_title text, event_message text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 INSERT INTO public."Notification"(id,"organizationId","userId","leadId",kind,title,message)
 SELECT gen_random_uuid(),l."organizationId",m."userId",l.id,event_kind,left(event_title,160),left(event_message,500)
 FROM public."Lead" l JOIN public."OrganizationMember" m ON m."organizationId"=l."organizationId"
 JOIN public."User" u ON u.id=m."userId"
 LEFT JOIN public."Broker" b ON b.id=l."brokerId" AND b."organizationId"=l."organizationId"
 WHERE l.id=lead_id AND (m.role IN ('OWNER','ADMIN') OR (m.role='MEMBER' AND (l."brokerId" IS NULL OR lower(b.email)=lower(u.email))));
$$;
CREATE FUNCTION public.notify_new_lead() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.notify_lead_team(NEW.id,'LEAD','Novo lead',NEW.name||' se cadastrou em '||(SELECT title FROM public."Property" WHERE id=NEW."propertyId"));
 RETURN NEW;
END $$;
CREATE TRIGGER new_lead_notification AFTER INSERT ON "Lead" FOR EACH ROW EXECUTE FUNCTION public.notify_new_lead();

CREATE FUNCTION public.notify_lead_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW."brokerId" IS DISTINCT FROM OLD."brokerId" THEN
  PERFORM public.notify_lead_team(NEW.id,'LEAD_ASSIGNED','Atendimento redistribuído',NEW.name||' teve o corretor responsável atualizado.');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lead_assignment_notification AFTER UPDATE OF "brokerId" ON "Lead" FOR EACH ROW EXECUTE FUNCTION public.notify_lead_assignment();

CREATE FUNCTION public.notify_visit_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l public."Lead"; destination text; event_kind text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 SELECT * INTO l FROM public."Lead" WHERE id=NEW."leadId" AND "organizationId"=NEW."organizationId";
 event_kind:=CASE WHEN TG_OP='INSERT' THEN 'VISIT_REQUESTED' ELSE 'VISIT_'||NEW.status END;
 PERFORM public.notify_lead_team(l.id,event_kind,CASE WHEN TG_OP='INSERT' THEN 'Nova solicitação de visita' WHEN NEW.status='CONFIRMED' THEN 'Visita confirmada' WHEN NEW.status='CANCELLED' THEN 'Visita cancelada' ELSE 'Visita a confirmar' END,
  l.name||' · '||to_char(NEW."preferredDate"::date,'DD/MM/YYYY')||' · '||CASE NEW.period WHEN 'MORNING' THEN 'Manhã' WHEN 'AFTERNOON' THEN 'Tarde' ELSE 'Noite' END);
 IF (TG_OP='INSERT' OR NEW.status='CONFIRMED') AND (SELECT "whatsappVisitAlerts" FROM public."Organization" WHERE id=NEW."organizationId") THEN
  SELECT phone INTO destination FROM public."Broker" WHERE id=l."brokerId" AND "organizationId"=l."organizationId" AND active;
  IF destination IS NULL THEN SELECT whatsapp INTO destination FROM public."Organization" WHERE id=l."organizationId"; END IF;
  IF length(destination) IN (10,11) THEN destination:='55'||destination; END IF;
  IF destination ~ '^[1-9][0-9]{10,14}$' THEN
   INSERT INTO public."WhatsAppDelivery"(id,"organizationId","requestId",kind,phone) VALUES(gen_random_uuid(),NEW."organizationId",NEW.id,event_kind,destination) ON CONFLICT DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER visit_request_notification AFTER INSERT OR UPDATE OF status ON "VisitRequest" FOR EACH ROW EXECUTE FUNCTION public.notify_visit_request();

CREATE FUNCTION public.notify_tour_return() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW."leadId" IS NOT NULL AND EXISTS(SELECT 1 FROM public."TourVisit" WHERE "leadId"=NEW."leadId" AND id<>NEW.id) THEN
  PERFORM public.notify_lead_team(NEW."leadId",'TOUR_RETURNED','Cliente voltou ao tour',(SELECT name FROM public."Lead" WHERE id=NEW."leadId")||' iniciou uma nova sessão.');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tour_return_notification AFTER INSERT ON "TourVisit" FOR EACH ROW EXECUTE FUNCTION public.notify_tour_return();

-- Enforce identification even for direct calls to the public database capability.
ALTER FUNCTION public.begin_tour_visit(jsonb,text,text) RENAME TO begin_identified_tour_visit;
CREATE FUNCTION public.begin_tour_visit(payload jsonb, token_hash text, abuse_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT (payload ? 'contact' OR payload ? 'returnKeyHash') THEN RAISE EXCEPTION 'identification required'; END IF;
 RETURN public.begin_identified_tour_visit(payload,token_hash,abuse_key);
END $$;

CREATE FUNCTION public.get_identified_tour(token_hash text)
RETURNS TABLE (id uuid,title text,document jsonb,assets jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT t.* FROM public."TourVisit" v JOIN public."Property" p ON p.id=v."propertyId" AND p."organizationId"=v."organizationId"
 CROSS JOIN LATERAL public.get_published_tours(p.slug) t
 WHERE v."tokenHash"=token_hash AND v."expiresAt">now() AND v."leadId" IS NOT NULL AND t.id=v."tourId";
$$;

-- Short leases allow retries after process termination; SKIP LOCKED prevents concurrent workers claiming the same job.
CREATE FUNCTION public.claim_whatsapp_deliveries(visit_token_hash text DEFAULT NULL)
RETURNS TABLE (id uuid,lease uuid,phone text,kind text,name text,property text,date text,period text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH candidates AS (
  SELECT d.id FROM public."WhatsAppDelivery" d JOIN public."Organization" o ON o.id=d."organizationId"
  JOIN public."VisitRequest" r ON r.id=d."requestId"
  WHERE d."sentAt" IS NULL AND d.attempts<5 AND d."availableAt"<=now() AND o."whatsappVisitAlerts" AND r.status<>'CANCELLED'
  AND (visit_token_hash IS NULL OR EXISTS(SELECT 1 FROM public."TourVisit" v WHERE v."tokenHash"=visit_token_hash AND v."leadId"=r."leadId" AND v."expiresAt">now()))
  ORDER BY d."createdAt" LIMIT 10 FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (
  UPDATE public."WhatsAppDelivery" d SET lease=gen_random_uuid(),attempts=attempts+1,"availableAt"=now()+interval '5 minutes'
  FROM candidates c WHERE d.id=c.id RETURNING d.*
 ) SELECT c.id,c.lease,c.phone::text,c.kind::text,l.name::text,p.title::text,r."preferredDate"::text,r.period::text
 FROM claimed c JOIN public."VisitRequest" r ON r.id=c."requestId" JOIN public."Lead" l ON l.id=r."leadId" AND l."organizationId"=r."organizationId"
 JOIN public."Property" p ON p.id=l."propertyId" AND p."organizationId"=l."organizationId";
$$;
CREATE FUNCTION public.finish_whatsapp_delivery(delivery_id uuid, delivery_lease uuid, error_code text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public."WhatsAppDelivery" SET "sentAt"=CASE WHEN error_code IS NULL THEN now() ELSE NULL END,
 "lastError"=left(error_code,80),"availableAt"=now()+interval '5 minutes'*attempts,lease=NULL
 WHERE id=delivery_id AND lease=delivery_lease AND "sentAt" IS NULL;
$$;

-- Internal trigger helpers and the ungated implementation must not be callable by runtime/API roles.
REVOKE ALL ON FUNCTION public.begin_identified_tour_visit(jsonb,text,text), public.assign_incoming_lead(), public.notify_lead_team(uuid,text,text,text), public.notify_new_lead(), public.notify_lead_assignment(), public.notify_visit_request(), public.notify_tour_return() FROM PUBLIC,imobview_app;
REVOKE ALL ON FUNCTION public.begin_tour_visit(jsonb,text,text), public.get_identified_tour(text), public.claim_whatsapp_deliveries(text), public.finish_whatsapp_delivery(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_tour_visit(jsonb,text,text), public.get_identified_tour(text), public.claim_whatsapp_deliveries(text), public.finish_whatsapp_delivery(uuid,uuid,text) TO imobview_app;
DO $$ DECLARE api_role text; BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
   EXECUTE format('REVOKE ALL ON public."Notification",public."WhatsAppDelivery" FROM %I',api_role);
   EXECUTE format('REVOKE ALL ON FUNCTION public.begin_identified_tour_visit(jsonb,text,text), public.assign_incoming_lead(), public.notify_lead_team(uuid,text,text,text), public.notify_new_lead(), public.notify_lead_assignment(), public.notify_visit_request(), public.notify_tour_return(), public.begin_tour_visit(jsonb,text,text), public.get_identified_tour(text), public.claim_whatsapp_deliveries(text), public.finish_whatsapp_delivery(uuid,uuid,text) FROM %I',api_role);
  END IF;
 END LOOP;
END $$;
COMMIT;
