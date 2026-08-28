CREATE TABLE "push_subscriptions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "endpoint_hash" CHAR(64) NOT NULL,
  "endpoint_encrypted" TEXT NOT NULL,
  "p256dh_encrypted" TEXT NOT NULL,
  "auth_encrypted" TEXT NOT NULL,
  "user_agent" VARCHAR(500),
  "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_hash_key" ON "push_subscriptions"("endpoint_hash");
CREATE INDEX "push_subscriptions_user_id_created_at_idx" ON "push_subscriptions"("user_id", "created_at" DESC);
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
