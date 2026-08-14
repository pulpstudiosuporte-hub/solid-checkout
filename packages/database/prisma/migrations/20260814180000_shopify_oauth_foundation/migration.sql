CREATE TABLE "shopify_connections" (
  "id" UUID NOT NULL, "store_id" UUID NOT NULL, "shop_domain" VARCHAR(255) NOT NULL,
  "access_token_encrypted" TEXT NOT NULL, "refresh_token_encrypted" TEXT, "scopes" TEXT NOT NULL,
  "access_token_expires_at" TIMESTAMPTZ(3), "refresh_token_expires_at" TIMESTAMPTZ(3),
  "connected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3), CONSTRAINT "shopify_connections_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "shopify_oauth_states" (
  "id" UUID NOT NULL, "state_hash" CHAR(64) NOT NULL, "store_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "session_id" UUID NOT NULL, "shop_domain" VARCHAR(255) NOT NULL, "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shopify_oauth_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shopify_connections_store_id_key" ON "shopify_connections"("store_id");
CREATE UNIQUE INDEX "shopify_connections_shop_domain_key" ON "shopify_connections"("shop_domain");
CREATE INDEX "shopify_connections_shop_domain_revoked_at_idx" ON "shopify_connections"("shop_domain", "revoked_at");
CREATE UNIQUE INDEX "shopify_oauth_states_state_hash_key" ON "shopify_oauth_states"("state_hash");
CREATE INDEX "shopify_oauth_states_store_id_expires_at_idx" ON "shopify_oauth_states"("store_id", "expires_at");
CREATE INDEX "shopify_oauth_states_session_id_expires_at_idx" ON "shopify_oauth_states"("session_id", "expires_at");
ALTER TABLE "shopify_connections" ADD CONSTRAINT "shopify_connections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_oauth_states" ADD CONSTRAINT "shopify_oauth_states_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_oauth_states" ADD CONSTRAINT "shopify_oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
