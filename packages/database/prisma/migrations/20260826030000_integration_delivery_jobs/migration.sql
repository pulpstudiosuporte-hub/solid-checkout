CREATE TYPE "DeliveryJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'DEAD');

CREATE TABLE "integration_delivery_jobs" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "checkout_session_id" UUID NOT NULL,
  "provider" VARCHAR(24) NOT NULL,
  "event" VARCHAR(40) NOT NULL,
  "status" "DeliveryJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3),
  "claimed_at" TIMESTAMPTZ(3),
  "delivered_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "integration_delivery_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_delivery_jobs_public_id_key" ON "integration_delivery_jobs"("public_id");
CREATE UNIQUE INDEX "integration_delivery_jobs_session_provider_event_key" ON "integration_delivery_jobs"("checkout_session_id", "provider", "event");
CREATE INDEX "integration_delivery_jobs_status_next_claimed_idx" ON "integration_delivery_jobs"("status", "next_attempt_at", "claimed_at");
CREATE INDEX "integration_delivery_jobs_store_created_idx" ON "integration_delivery_jobs"("store_id", "created_at" DESC);
ALTER TABLE "integration_delivery_jobs" ADD CONSTRAINT "integration_delivery_jobs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_delivery_jobs" ADD CONSTRAINT "integration_delivery_jobs_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
