CREATE TYPE "ProductSource" AS ENUM ('MANUAL', 'SHOPIFY');
CREATE TYPE "CheckoutStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "source" "ProductSource" NOT NULL DEFAULT 'MANUAL',
  "source_external_id" VARCHAR(128),
  "source_title" VARCHAR(240) NOT NULL,
  "checkout_title" VARCHAR(240) NOT NULL,
  "checkout_description" TEXT,
  "image_url" VARCHAR(2048),
  "price_cents" INTEGER NOT NULL,
  "compare_at_cents" INTEGER,
  "stock_quantity" INTEGER,
  "track_inventory" BOOLEAN NOT NULL DEFAULT false,
  "max_per_order" INTEGER NOT NULL DEFAULT 10,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_check" CHECK ("price_cents" >= 0),
  CONSTRAINT "products_compare_at_check" CHECK ("compare_at_cents" IS NULL OR "compare_at_cents" > "price_cents"),
  CONSTRAINT "products_stock_check" CHECK ("stock_quantity" IS NULL OR "stock_quantity" >= 0),
  CONSTRAINT "products_max_per_order_check" CHECK ("max_per_order" BETWEEN 1 AND 1000)
);

CREATE TABLE "checkouts" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "status" "CheckoutStatus" NOT NULL DEFAULT 'DRAFT',
  "draft_config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkouts_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX "products_public_id_key" ON "products"("public_id");
CREATE UNIQUE INDEX "products_store_id_source_source_external_id_key" ON "products"("store_id", "source", "source_external_id");
CREATE INDEX "products_store_id_active_created_at_idx" ON "products"("store_id", "active", "created_at" DESC);
CREATE UNIQUE INDEX "checkouts_public_id_key" ON "checkouts"("public_id");
CREATE UNIQUE INDEX "checkouts_store_id_slug_key" ON "checkouts"("store_id", "slug");
CREATE INDEX "checkouts_store_id_status_created_at_idx" ON "checkouts"("store_id", "status", "created_at" DESC);
CREATE INDEX "checkouts_store_id_product_id_idx" ON "checkouts"("store_id", "product_id");

ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
