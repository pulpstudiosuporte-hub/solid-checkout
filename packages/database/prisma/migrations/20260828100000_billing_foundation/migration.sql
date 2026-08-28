CREATE TYPE "BillingPlan" AS ENUM ('START', 'PRIME', 'ELITE');
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID', 'CANCELED', 'INCOMPLETE');
CREATE TYPE "BillingEntryType" AS ENUM ('TRANSACTION_FEE', 'REFUND_CREDIT');

CREATE TABLE "billing_subscriptions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "plan" "BillingPlan" NOT NULL DEFAULT 'START',
  "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "monthly_price_cents" INTEGER NOT NULL DEFAULT 0,
  "fee_basis_points" INTEGER NOT NULL DEFAULT 200,
  "stripe_customer_id" VARCHAR(128),
  "stripe_subscription_id" VARCHAR(128),
  "current_period_start" TIMESTAMPTZ(3),
  "current_period_end" TIMESTAMPTZ(3),
  "grace_until" TIMESTAMPTZ(3),
  "blocked_at" TIMESTAMPTZ(3),
  "canceled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_ledger_entries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "payment_attempt_id" UUID NOT NULL,
  "type" "BillingEntryType" NOT NULL,
  "gross_amount_cents" INTEGER NOT NULL,
  "fee_basis_points" INTEGER NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "stripe_invoice_id" VARCHAR(128),
  "billed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_subscriptions_user_id_key" ON "billing_subscriptions"("user_id");
CREATE UNIQUE INDEX "billing_subscriptions_stripe_customer_id_key" ON "billing_subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "billing_subscriptions_stripe_subscription_id_key" ON "billing_subscriptions"("stripe_subscription_id");
CREATE INDEX "billing_subscriptions_status_grace_until_idx" ON "billing_subscriptions"("status", "grace_until");
CREATE UNIQUE INDEX "billing_ledger_entries_payment_attempt_id_type_key" ON "billing_ledger_entries"("payment_attempt_id", "type");
CREATE INDEX "billing_ledger_entries_user_id_billed_at_occurred_at_idx" ON "billing_ledger_entries"("user_id", "billed_at", "occurred_at");

ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
