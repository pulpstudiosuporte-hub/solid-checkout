ALTER TABLE "shopify_connections"
ADD COLUMN "reconnect_required_at" TIMESTAMPTZ(3),
ADD COLUMN "reconnect_reason" VARCHAR(500);

CREATE INDEX "shopify_connections_store_id_reconnect_required_at_idx"
ON "shopify_connections"("store_id", "reconnect_required_at");
