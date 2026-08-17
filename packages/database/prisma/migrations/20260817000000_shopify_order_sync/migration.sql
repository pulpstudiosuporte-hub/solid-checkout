ALTER TABLE "checkout_sessions"
  ADD COLUMN "shopify_order_id" VARCHAR(128),
  ADD COLUMN "shopify_order_name" VARCHAR(120),
  ADD COLUMN "shopify_sync_status" VARCHAR(16),
  ADD COLUMN "shopify_sync_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "shopify_synced_at" TIMESTAMPTZ(3),
  ADD COLUMN "shopify_sync_error" VARCHAR(500);

CREATE UNIQUE INDEX "checkout_sessions_shopify_order_id_key" ON "checkout_sessions"("shopify_order_id");
CREATE INDEX "checkout_sessions_shopify_sync_status_shopify_sync_started_at_idx" ON "checkout_sessions"("shopify_sync_status", "shopify_sync_started_at");
