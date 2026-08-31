CREATE TYPE "ProductReleaseCategory" AS ENUM ('NEWS', 'IMPROVEMENT', 'FIX', 'INTEGRATION', 'SECURITY');

CREATE TABLE "product_releases" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "category" "ProductReleaseCategory" NOT NULL DEFAULT 'NEWS',
  "title" VARCHAR(140) NOT NULL,
  "description" TEXT NOT NULL,
  "image_url" VARCHAR(2048),
  "video_url" VARCHAR(2048),
  "published" BOOLEAN NOT NULL DEFAULT true,
  "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_catalog_assets" (
  "id" UUID NOT NULL,
  "integration_key" VARCHAR(64) NOT NULL,
  "image_url" VARCHAR(2048) NOT NULL,
  "alt_text" VARCHAR(160) NOT NULL DEFAULT '',
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "integration_catalog_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_releases_public_id_key" ON "product_releases"("public_id");
CREATE INDEX "product_releases_published_published_at_idx" ON "product_releases"("published", "published_at" DESC);
CREATE UNIQUE INDEX "integration_catalog_assets_integration_key_key" ON "integration_catalog_assets"("integration_key");
