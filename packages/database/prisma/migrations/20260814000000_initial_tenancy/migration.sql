-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "name" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255),
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_members" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "StoreRole" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "store_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "active_store_id" UUID,
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(512),
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "store_id" UUID,
    "actor_user_id" UUID,
    "actor_type" "AuditActorType" NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "target_type" VARCHAR(80),
    "target_id" VARCHAR(128),
    "request_id" VARCHAR(128),
    "ip_hash" CHAR(64),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stores_public_id_key" ON "stores"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE INDEX "store_members_user_id_idx" ON "store_members"("user_id");

-- CreateIndex
CREATE INDEX "store_members_store_id_role_idx" ON "store_members"("store_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "store_members_store_id_user_id_key" ON "store_members"("store_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_store_id_created_at_idx" ON "audit_logs"("store_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_store_id_user_id_fkey" FOREIGN KEY ("active_store_id", "user_id") REFERENCES "store_members"("store_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants enforced below the application layer.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized_check" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "stores" ADD CONSTRAINT "stores_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiration_order_check" CHECK ("expires_at" <= "absolute_expires_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revocation_time_check" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_consistency_check" CHECK (
  ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL) OR
  ("actor_type" = 'SYSTEM' AND "actor_user_id" IS NULL)
);
