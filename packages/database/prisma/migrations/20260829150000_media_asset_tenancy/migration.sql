ALTER TABLE "media_assets" ADD COLUMN "store_id" UUID;

CREATE INDEX "media_assets_store_id_created_at_idx"
ON "media_assets"("store_id", "created_at");

ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
