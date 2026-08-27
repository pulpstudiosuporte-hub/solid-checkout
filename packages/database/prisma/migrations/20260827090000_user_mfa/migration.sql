ALTER TABLE "users"
  ADD COLUMN "mfa_secret_encrypted" TEXT,
  ADD COLUMN "mfa_pending_secret_encrypted" TEXT,
  ADD COLUMN "mfa_enabled_at" TIMESTAMPTZ(3);

ALTER TABLE "sessions"
  ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(3);

CREATE TABLE "mfa_challenges" (
  "id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_recovery_codes" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_challenges_token_hash_key" ON "mfa_challenges"("token_hash");
CREATE INDEX "mfa_challenges_user_id_expires_at_idx" ON "mfa_challenges"("user_id", "expires_at");
CREATE UNIQUE INDEX "mfa_recovery_codes_user_id_code_hash_key" ON "mfa_recovery_codes"("user_id", "code_hash");
CREATE INDEX "mfa_recovery_codes_user_id_used_at_idx" ON "mfa_recovery_codes"("user_id", "used_at");

ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
