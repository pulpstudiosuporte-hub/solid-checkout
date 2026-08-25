ALTER TABLE "checkout_sessions"
ADD COLUMN "tracking_parameters" JSONB NOT NULL DEFAULT '{}';
