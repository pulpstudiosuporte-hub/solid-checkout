ALTER TABLE "billing_ledger_entries" ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "billing_ledger_entries_payment_attempt_id_type_key";
CREATE UNIQUE INDEX "billing_ledger_entries_payment_attempt_id_type_sequence_key"
ON "billing_ledger_entries"("payment_attempt_id", "type", "sequence");
