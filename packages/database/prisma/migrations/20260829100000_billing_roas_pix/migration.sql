CREATE TYPE "BillingPaymentProvider" AS ENUM ('STRIPE', 'ROAS');
CREATE TYPE "BillingPixStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

ALTER TABLE "billing_subscriptions" ADD COLUMN "payment_provider" "BillingPaymentProvider";

CREATE TABLE "billing_pix_invoices" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "user_id" UUID NOT NULL,
  "plan" "BillingPlan" NOT NULL,
  "status" "BillingPixStatus" NOT NULL DEFAULT 'PENDING',
  "provider_transaction_id" VARCHAR(128) NOT NULL,
  "monthly_amount_cents" INTEGER NOT NULL,
  "usage_amount_cents" INTEGER NOT NULL,
  "total_amount_cents" INTEGER NOT NULL,
  "pix_code_encrypted" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3),
  "paid_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "billing_pix_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_pix_invoices_public_id_key" ON "billing_pix_invoices"("public_id");
CREATE UNIQUE INDEX "billing_pix_invoices_provider_transaction_id_key" ON "billing_pix_invoices"("provider_transaction_id");
CREATE INDEX "billing_pix_invoices_user_id_status_created_at_idx" ON "billing_pix_invoices"("user_id", "status", "created_at" DESC);
CREATE INDEX "billing_pix_invoices_status_expires_at_idx" ON "billing_pix_invoices"("status", "expires_at");
ALTER TABLE "billing_pix_invoices" ADD CONSTRAINT "billing_pix_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
