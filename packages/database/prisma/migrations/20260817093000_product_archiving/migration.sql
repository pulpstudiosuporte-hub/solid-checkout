ALTER TABLE "products" ADD COLUMN "archived_at" TIMESTAMPTZ(3);

CREATE INDEX "products_store_id_archived_at_idx" ON "products"("store_id", "archived_at");
