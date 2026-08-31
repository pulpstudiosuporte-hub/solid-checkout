ALTER TABLE "webhook_deliveries"
  ADD COLUMN "event_id" VARCHAR(64),
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "status" "DeliveryJobStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3),
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "delivered_at" TIMESTAMPTZ(3);

UPDATE "webhook_deliveries"
SET "event_id" = 'legacy_' || "public_id",
    "payload" = '{}'::jsonb,
    "status" = CASE WHEN "success" THEN 'DELIVERED'::"DeliveryJobStatus" ELSE 'DEAD'::"DeliveryJobStatus" END,
    "delivered_at" = CASE WHEN "success" THEN "created_at" ELSE NULL END;

ALTER TABLE "webhook_deliveries"
  ALTER COLUMN "event_id" SET NOT NULL,
  ALTER COLUMN "payload" SET NOT NULL;

CREATE UNIQUE INDEX "webhook_deliveries_webhook_endpoint_id_event_id_key"
  ON "webhook_deliveries"("webhook_endpoint_id", "event_id");
CREATE INDEX "webhook_deliveries_status_next_attempt_at_claimed_at_idx"
  ON "webhook_deliveries"("status", "next_attempt_at", "claimed_at");

CREATE INDEX "checkout_sessions_checkout_id_created_at_idx" ON "checkout_sessions"("checkout_id", "created_at" DESC);
CREATE INDEX "checkout_sessions_checkout_id_updated_at_idx" ON "checkout_sessions"("checkout_id", "updated_at" DESC);
CREATE INDEX "payment_attempts_status_paid_at_checkout_session_id_idx" ON "payment_attempts"("status", "paid_at", "checkout_session_id");
