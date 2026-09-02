CREATE TYPE "CheckoutMode" AS ENUM ('DIRECT_LINK', 'SHOPIFY_CART');

ALTER TABLE "checkouts"
  ADD COLUMN "mode" "CheckoutMode" NOT NULL DEFAULT 'DIRECT_LINK',
  ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "product_id" DROP NOT NULL;

CREATE INDEX "checkouts_store_id_mode_status_idx"
  ON "checkouts"("store_id", "mode", "status");

CREATE UNIQUE INDEX "checkouts_one_default_shopify_per_store"
  ON "checkouts"("store_id")
  WHERE "mode" = 'SHOPIFY_CART' AND "is_default" = true AND "archived_at" IS NULL;
