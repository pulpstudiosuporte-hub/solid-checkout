CREATE TABLE "abandoned_recovery_settings" (
  "id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "activated_at" TIMESTAMPTZ(3),
  "first_delay_minutes" INTEGER NOT NULL DEFAULT 60,
  "second_enabled" BOOLEAN NOT NULL DEFAULT false,
  "second_delay_hours" INTEGER NOT NULL DEFAULT 24,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "abandoned_recovery_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "abandoned_recovery_deliveries" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "checkout_session_id" UUID NOT NULL,
  "step" INTEGER NOT NULL,
  "status" "DeliveryJobStatus" NOT NULL DEFAULT 'PENDING',
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimed_at" TIMESTAMPTZ(3),
  "delivered_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "abandoned_recovery_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "abandoned_recovery_settings_store_id_key" ON "abandoned_recovery_settings"("store_id");
CREATE UNIQUE INDEX "abandoned_recovery_deliveries_public_id_key" ON "abandoned_recovery_deliveries"("public_id");
CREATE UNIQUE INDEX "abandoned_recovery_deliveries_checkout_session_id_step_key" ON "abandoned_recovery_deliveries"("checkout_session_id", "step");
CREATE INDEX "abandoned_recovery_deliveries_status_scheduled_at_claimed_at_idx" ON "abandoned_recovery_deliveries"("status", "scheduled_at", "claimed_at");
CREATE INDEX "abandoned_recovery_deliveries_store_id_created_at_idx" ON "abandoned_recovery_deliveries"("store_id", "created_at" DESC);

ALTER TABLE "abandoned_recovery_settings" ADD CONSTRAINT "abandoned_recovery_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abandoned_recovery_deliveries" ADD CONSTRAINT "abandoned_recovery_deliveries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abandoned_recovery_deliveries" ADD CONSTRAINT "abandoned_recovery_deliveries_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
