ALTER TABLE "checkout_sessions"
ADD COLUMN "customer_data_encrypted" TEXT,
ADD COLUMN "customer_email_hash" CHAR(64),
ADD COLUMN "customer_document_hash" CHAR(64),
ADD COLUMN "shipping_address_encrypted" TEXT,
ADD COLUMN "customer_captured_at" TIMESTAMPTZ(3),
ADD COLUMN "shipping_captured_at" TIMESTAMPTZ(3);

CREATE INDEX "checkout_sessions_customer_email_hash_idx" ON "checkout_sessions"("customer_email_hash");
