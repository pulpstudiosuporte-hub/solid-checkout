CREATE TABLE "shipping_methods" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "price_cents" INTEGER NOT NULL,
  "min_days" INTEGER NOT NULL,
  "max_days" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_methods_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shipping_methods_price_nonnegative" CHECK ("price_cents" >= 0),
  CONSTRAINT "shipping_methods_days_valid" CHECK ("min_days" >= 0 AND "max_days" >= "min_days")
);
CREATE UNIQUE INDEX "shipping_methods_public_id_key" ON "shipping_methods"("public_id");
CREATE INDEX "shipping_methods_store_id_active_position_idx" ON "shipping_methods"("store_id", "active", "position");

ALTER TABLE "checkout_sessions"
  ADD COLUMN "shipping_method_public_id" VARCHAR(32),
  ADD COLUMN "shipping_method_name" VARCHAR(120),
  ADD COLUMN "shipping_price_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "shipping_min_days" INTEGER,
  ADD COLUMN "shipping_max_days" INTEGER;
