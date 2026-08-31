CREATE TYPE "ProductFeedbackType" AS ENUM ('SUGGESTION', 'BUG');
CREATE TYPE "ProductFeedbackStatus" AS ENUM ('BACKLOG', 'PLANNED', 'IN_PROGRESS', 'DONE');

CREATE TABLE "product_feedback" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "user_id" UUID NOT NULL,
  "store_id" UUID,
  "type" "ProductFeedbackType" NOT NULL DEFAULT 'SUGGESTION',
  "status" "ProductFeedbackStatus" NOT NULL DEFAULT 'BACKLOG',
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_feedback_votes" (
  "id" UUID NOT NULL,
  "feedback_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_feedback_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_feedback_public_id_key" ON "product_feedback"("public_id");
CREATE INDEX "product_feedback_status_created_at_idx" ON "product_feedback"("status", "created_at" DESC);
CREATE INDEX "product_feedback_user_id_created_at_idx" ON "product_feedback"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX "product_feedback_votes_feedback_id_user_id_key" ON "product_feedback_votes"("feedback_id", "user_id");
CREATE INDEX "product_feedback_votes_user_id_idx" ON "product_feedback_votes"("user_id");

ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_feedback" ADD CONSTRAINT "product_feedback_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_feedback_votes" ADD CONSTRAINT "product_feedback_votes_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "product_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_feedback_votes" ADD CONSTRAINT "product_feedback_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
