CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "content_encrypted" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_receipts_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 3145728),
    CONSTRAINT "payment_receipts_type_check" CHECK ("mime_type" IN ('application/pdf', 'image/webp'))
);
CREATE UNIQUE INDEX "payment_receipts_payment_attempt_id_key" ON "payment_receipts"("payment_attempt_id");
CREATE INDEX "payment_receipts_created_at_idx" ON "payment_receipts"("created_at");
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
