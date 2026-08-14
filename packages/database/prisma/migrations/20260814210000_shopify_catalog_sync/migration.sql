ALTER TABLE "products"
  ADD COLUMN "source_description_html" TEXT,
  ADD COLUMN "handle" VARCHAR(255),
  ADD COLUMN "vendor" VARCHAR(255),
  ADD COLUMN "product_type" VARCHAR(255),
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "source_status" VARCHAR(32),
  ADD COLUMN "source_updated_at" TIMESTAMPTZ(3),
  ADD COLUMN "synced_at" TIMESTAMPTZ(3);

ALTER TABLE "shopify_connections" ADD COLUMN "last_synced_at" TIMESTAMPTZ(3);

CREATE TABLE "product_variants" (
  "id" UUID NOT NULL, "public_id" VARCHAR(32) NOT NULL, "product_id" UUID NOT NULL,
  "source_external_id" VARCHAR(128) NOT NULL, "title" VARCHAR(240) NOT NULL,
  "sku" VARCHAR(255), "barcode" VARCHAR(255), "price_cents" INTEGER NOT NULL,
  "compare_at_cents" INTEGER, "inventory_quantity" INTEGER, "available_for_sale" BOOLEAN NOT NULL DEFAULT true,
  "image_url" VARCHAR(2048), "selected_options" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_variants_public_id_key" ON "product_variants"("public_id");
CREATE UNIQUE INDEX "product_variants_product_id_source_external_id_key" ON "product_variants"("product_id", "source_external_id");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

CREATE TABLE "product_images" (
  "id" UUID NOT NULL, "product_id" UUID NOT NULL, "source_external_id" VARCHAR(128) NOT NULL,
  "url" VARCHAR(2048) NOT NULL, "alt_text" VARCHAR(512), "width" INTEGER, "height" INTEGER, "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_images_product_id_source_external_id_key" ON "product_images"("product_id", "source_external_id");
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");

CREATE TABLE "shopify_collections" (
  "id" UUID NOT NULL, "public_id" VARCHAR(32) NOT NULL, "store_id" UUID NOT NULL,
  "source_external_id" VARCHAR(128) NOT NULL, "title" VARCHAR(240) NOT NULL, "handle" VARCHAR(255) NOT NULL,
  "description_html" TEXT, "image_url" VARCHAR(2048), "source_updated_at" TIMESTAMPTZ(3), "synced_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "shopify_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shopify_collections_public_id_key" ON "shopify_collections"("public_id");
CREATE UNIQUE INDEX "shopify_collections_store_id_source_external_id_key" ON "shopify_collections"("store_id", "source_external_id");
CREATE INDEX "shopify_collections_store_id_title_idx" ON "shopify_collections"("store_id", "title");

CREATE TABLE "product_collections" (
  "product_id" UUID NOT NULL, "collection_id" UUID NOT NULL,
  CONSTRAINT "product_collections_pkey" PRIMARY KEY ("product_id", "collection_id")
);
CREATE INDEX "product_collections_collection_id_idx" ON "product_collections"("collection_id");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_collections" ADD CONSTRAINT "shopify_collections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "shopify_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
