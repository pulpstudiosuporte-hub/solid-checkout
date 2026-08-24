ALTER TABLE "products"
  ADD COLUMN "fulfillment_type" VARCHAR(16) NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "external_delivery_url" VARCHAR(2048);
