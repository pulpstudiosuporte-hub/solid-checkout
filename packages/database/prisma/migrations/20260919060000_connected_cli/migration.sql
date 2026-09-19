CREATE TABLE "cli_devices" (
 "id" VARCHAR(32) PRIMARY KEY, "token_hash" VARCHAR(64) NOT NULL UNIQUE,
 "challenge" VARCHAR(64) NOT NULL, "user_code" VARCHAR(16) NOT NULL UNIQUE,
 "label" VARCHAR(80) NOT NULL, "user_id" UUID, "store_id" UUID,
 "can_publish" BOOLEAN NOT NULL DEFAULT false, "expires_at" TIMESTAMPTZ(3) NOT NULL, "consumed_at" TIMESTAMPTZ(3)
);
CREATE INDEX "cli_devices_expires_at_idx" ON "cli_devices"("expires_at");
CREATE TABLE "cli_connections" (
 "id" VARCHAR(32) PRIMARY KEY, "token_hash" VARCHAR(64) NOT NULL UNIQUE,
 "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "store_id" UUID NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "label" VARCHAR(80) NOT NULL, "can_publish" BOOLEAN NOT NULL DEFAULT false,
 "expires_at" TIMESTAMPTZ(3) NOT NULL, "revoked_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "cli_connections_store_id_user_id_idx" ON "cli_connections"("store_id", "user_id");
CREATE TABLE "checkout_cli_versions" (
 "id" VARCHAR(32) PRIMARY KEY, "checkout_id" UUID NOT NULL REFERENCES "checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "config" JSONB NOT NULL, "action" VARCHAR(24) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "checkout_cli_versions_checkout_id_created_at_idx" ON "checkout_cli_versions"("checkout_id", "created_at" DESC);
