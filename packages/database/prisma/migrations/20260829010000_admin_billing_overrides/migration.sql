ALTER TABLE "billing_subscriptions"
  ADD COLUMN "admin_plan_override" "BillingPlan",
  ADD COLUMN "admin_fee_basis_points" INTEGER,
  ADD COLUMN "admin_monthly_waived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "admin_override_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "admin_override_reason" VARCHAR(240);

ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_admin_fee_basis_points_check"
  CHECK ("admin_fee_basis_points" IS NULL OR ("admin_fee_basis_points" >= 0 AND "admin_fee_basis_points" <= 1000));

CREATE INDEX "billing_subscriptions_admin_override_expires_at_idx"
  ON "billing_subscriptions"("admin_override_expires_at");
