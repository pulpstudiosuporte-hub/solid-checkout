ALTER TABLE "payment_attempts"
  ADD COLUMN "creation_state" VARCHAR(16) NOT NULL DEFAULT 'READY',
  ADD COLUMN "next_verification_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "verification_failures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "partial_refund_at" TIMESTAMPTZ(3),
  ADD COLUMN "refunded_amount_cents" INTEGER;
-- A legacy pending attempt without a persisted response may already exist externally.
UPDATE "payment_attempts" SET "creation_state" = 'UNCERTAIN'
WHERE "status" = 'PENDING' AND "pix_code_encrypted" IS NULL;
CREATE INDEX "payment_attempts_provider_status_next_verification_at_idx"
ON "payment_attempts"("provider", "status", "next_verification_at");
