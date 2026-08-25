CREATE TABLE "pending_signups" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "store_slug" VARCHAR(80) NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "email_sent_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "pending_signups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pending_signups_email_key" ON "pending_signups"("email");
CREATE UNIQUE INDEX "pending_signups_token_hash_key" ON "pending_signups"("token_hash");
CREATE INDEX "pending_signups_expires_at_idx" ON "pending_signups"("expires_at");
