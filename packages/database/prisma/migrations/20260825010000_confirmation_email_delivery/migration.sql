ALTER TABLE "checkout_sessions"
  ADD COLUMN "confirmation_email_sent_at" TIMESTAMPTZ(3),
  ADD COLUMN "confirmation_email_claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "confirmation_email_next_attempt_at" TIMESTAMPTZ(3),
  ADD COLUMN "confirmation_email_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "confirmation_email_last_error" VARCHAR(500);

-- Pedidos antigos não devem disparar e-mails retroativos quando o worker entrar no ar.
UPDATE "checkout_sessions"
SET "confirmation_email_sent_at" = COALESCE("completed_at", NOW())
WHERE "status" = 'COMPLETED';

CREATE INDEX "checkout_sessions_status_confirmation_email_sent_at_confirmation_email_next_attempt_at_idx"
  ON "checkout_sessions"("status", "confirmation_email_sent_at", "confirmation_email_next_attempt_at");
