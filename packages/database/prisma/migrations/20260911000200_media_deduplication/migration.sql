ALTER TABLE "media_assets" ADD COLUMN "content_hash" CHAR(64);
CREATE INDEX "media_assets_store_id_content_hash_idx" ON "media_assets"("store_id", "content_hash");
