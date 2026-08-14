ALTER TABLE "checkouts"
ADD COLUMN "published_config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "published_at" TIMESTAMPTZ(3);

UPDATE "checkouts"
SET "published_config" = "draft_config", "published_at" = NOW()
WHERE "status" = 'PUBLISHED';
