ALTER TABLE "product_feedback"
ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "product_feedback_status_created_at_idx";
CREATE INDEX "product_feedback_approved_status_created_at_idx"
ON "product_feedback"("approved", "status", "created_at" DESC);
