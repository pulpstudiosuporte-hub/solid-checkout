CREATE TABLE "webhook_endpoints" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(240),
  "url" VARCHAR(2048) NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "events" TEXT[] NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "webhook_deliveries" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "webhook_endpoint_id" UUID NOT NULL,
  "event" VARCHAR(64) NOT NULL,
  "status_code" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "duration_ms" INTEGER,
  "error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "webhook_endpoints_public_id_key" ON "webhook_endpoints"("public_id");
CREATE INDEX "webhook_endpoints_store_id_active_created_at_idx" ON "webhook_endpoints"("store_id", "active", "created_at" DESC);
CREATE UNIQUE INDEX "webhook_deliveries_public_id_key" ON "webhook_deliveries"("public_id");
CREATE INDEX "webhook_deliveries_webhook_endpoint_id_created_at_idx" ON "webhook_deliveries"("webhook_endpoint_id", "created_at" DESC);
CREATE INDEX "webhook_deliveries_store_id_created_at_idx" ON "webhook_deliveries"("store_id", "created_at" DESC);
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_fkey" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
