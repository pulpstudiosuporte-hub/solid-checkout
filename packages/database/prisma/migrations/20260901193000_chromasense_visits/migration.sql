ALTER TABLE "chromasense_sessions" ADD COLUMN "visit_id" UUID;
UPDATE "chromasense_sessions" SET "visit_id" = "id" WHERE "visit_id" IS NULL;
ALTER TABLE "chromasense_sessions" ALTER COLUMN "visit_id" SET NOT NULL;
DROP INDEX IF EXISTS "chromasense_sessions_checkout_session_id_key";
CREATE UNIQUE INDEX "chromasense_sessions_visit_id_key" ON "chromasense_sessions"("visit_id");
CREATE INDEX "chromasense_sessions_checkout_session_id_started_at_idx" ON "chromasense_sessions"("checkout_session_id", "started_at" DESC);
