CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "coupons" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "type" "CouponType" NOT NULL,
  "value" INTEGER NOT NULL,
  "minimum_subtotal_cents" INTEGER NOT NULL DEFAULT 0,
  "max_discount_cents" INTEGER,
  "max_redemptions" INTEGER,
  "redemption_count" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "checkout_sessions"
  ADD COLUMN "coupon_id" UUID,
  ADD COLUMN "coupon_code" VARCHAR(40),
  ADD COLUMN "discount_cents" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "coupons_public_id_key" ON "coupons"("public_id");
CREATE UNIQUE INDEX "coupons_store_id_code_key" ON "coupons"("store_id", "code");
CREATE INDEX "coupons_store_id_active_created_at_idx" ON "coupons"("store_id", "active", "created_at" DESC);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
