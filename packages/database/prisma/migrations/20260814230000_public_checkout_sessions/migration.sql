CREATE TYPE "CheckoutSessionStatus" AS ENUM ('OPEN', 'EXPIRED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "checkout_sessions" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "checkout_id" UUID NOT NULL,
  "variant_id" UUID,
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "total_cents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
  "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'OPEN',
  "source" VARCHAR(32) NOT NULL DEFAULT 'DIRECT',
  "source_cart_id" VARCHAR(255),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkout_sessions_quantity_check" CHECK ("quantity" >= 1 AND "quantity" <= 1000),
  CONSTRAINT "checkout_sessions_prices_check" CHECK ("unit_price_cents" >= 0 AND "total_cents" >= 0)
);

CREATE UNIQUE INDEX "checkout_sessions_public_id_key" ON "checkout_sessions"("public_id");
CREATE UNIQUE INDEX "checkout_sessions_token_hash_key" ON "checkout_sessions"("token_hash");
CREATE INDEX "checkout_sessions_checkout_id_status_expires_at_idx" ON "checkout_sessions"("checkout_id", "status", "expires_at");
CREATE INDEX "checkout_sessions_expires_at_idx" ON "checkout_sessions"("expires_at");
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
