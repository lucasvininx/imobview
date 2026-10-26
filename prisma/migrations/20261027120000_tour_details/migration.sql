-- Clicks on a room's information points ("i") are recorded as DETAIL events with the room id.
ALTER TABLE "JourneyEvent" DROP CONSTRAINT event_bounds;
ALTER TABLE "JourneyEvent" ADD CONSTRAINT event_bounds CHECK ("durationMs" BETWEEN 0 AND 30000 AND sequence BETWEEN 1 AND 2500 AND kind IN ('START','SCENE','HEARTBEAT','EXIT','COMPLETE','CONTACT','SHARE','HOTSPOT','SIMULATE','DETAIL'));
