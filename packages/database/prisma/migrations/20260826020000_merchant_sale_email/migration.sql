ALTER TABLE "checkout_sessions"
  ADD COLUMN "merchant_email_sent_at" TIMESTAMPTZ(3),
  ADD COLUMN "merchant_email_claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "merchant_email_next_attempt_at" TIMESTAMPTZ(3),
  ADD COLUMN "merchant_email_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "merchant_email_last_error" VARCHAR(500);

-- Do not notify merchants again for orders that existed before this feature.
UPDATE "checkout_sessions"
SET "merchant_email_sent_at" = NOW()
WHERE "status" = 'COMPLETED';

CREATE INDEX "checkout_sessions_status_merchant_email_sent_at_merchant_email_next_attempt_at_idx"
  ON "checkout_sessions"("status", "merchant_email_sent_at", "merchant_email_next_attempt_at");
