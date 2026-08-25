ALTER TABLE "checkouts" ADD COLUMN "archived_at" TIMESTAMPTZ(3);

CREATE INDEX "checkouts_store_id_archived_at_idx" ON "checkouts"("store_id", "archived_at");
