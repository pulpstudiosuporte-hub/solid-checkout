ALTER TABLE "checkout_session_items"
ADD COLUMN "is_order_bump" BOOLEAN NOT NULL DEFAULT false;
