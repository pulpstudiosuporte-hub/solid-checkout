CREATE TABLE "checkout_session_items" (
  "id" UUID NOT NULL,
  "checkout_session_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "total_cents" INTEGER NOT NULL,
  "title_snapshot" VARCHAR(240) NOT NULL,
  "variant_snapshot" VARCHAR(240),
  "image_url_snapshot" VARCHAR(2048),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_session_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkout_session_items_quantity_check" CHECK ("quantity" >= 1 AND "quantity" <= 1000),
  CONSTRAINT "checkout_session_items_prices_check" CHECK ("unit_price_cents" >= 0 AND "total_cents" >= 0)
);
CREATE INDEX "checkout_session_items_checkout_session_id_idx" ON "checkout_session_items"("checkout_session_id");
CREATE INDEX "checkout_session_items_product_id_idx" ON "checkout_session_items"("product_id");
ALTER TABLE "checkout_session_items" ADD CONSTRAINT "checkout_session_items_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkout_session_items" ADD CONSTRAINT "checkout_session_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkout_session_items" ADD CONSTRAINT "checkout_session_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
