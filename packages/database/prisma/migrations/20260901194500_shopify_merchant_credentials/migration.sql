ALTER TABLE "shopify_connections"
  ADD COLUMN "auth_mode" VARCHAR(24) NOT NULL DEFAULT 'OAUTH',
  ADD COLUMN "client_id_encrypted" TEXT,
  ADD COLUMN "client_secret_encrypted" TEXT;

ALTER TABLE "shopify_connections"
  ADD CONSTRAINT "shopify_connections_auth_mode_check"
  CHECK ("auth_mode" IN ('OAUTH', 'CLIENT_CREDENTIALS'));
