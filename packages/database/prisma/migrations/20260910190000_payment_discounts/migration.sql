ALTER TABLE "checkout_sessions"
  ADD COLUMN "payment_discount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payment_discount_rule" JSONB;

CREATE TABLE "payment_discounts" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "payment_method" VARCHAR(32) NOT NULL,
  "percentage_bps" INTEGER NOT NULL,
  "minimum_amount_cents" INTEGER NOT NULL DEFAULT 0,
  "maximum_amount_cents" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "payment_discounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_discounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_discounts_valid_rule" CHECK (
    "payment_method" = 'PIX' AND "percentage_bps" BETWEEN 1 AND 10000
    AND "minimum_amount_cents" >= 0 AND ("maximum_amount_cents" IS NULL OR "maximum_amount_cents" > 0)
  )
);
CREATE UNIQUE INDEX "payment_discounts_public_id_key" ON "payment_discounts"("public_id");
CREATE UNIQUE INDEX "payment_discounts_store_id_payment_method_key" ON "payment_discounts"("store_id", "payment_method");
CREATE INDEX "payment_discounts_store_id_active_idx" ON "payment_discounts"("store_id", "active");
