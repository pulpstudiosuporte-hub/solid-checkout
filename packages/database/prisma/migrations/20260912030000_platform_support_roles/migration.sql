CREATE TABLE "platform_roles" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240) NOT NULL DEFAULT '',
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_roles_public_id_key" ON "platform_roles"("public_id");
CREATE UNIQUE INDEX "platform_roles_name_key" ON "platform_roles"("name");
ALTER TABLE "users" ADD COLUMN "platform_role_id" UUID;
CREATE INDEX "users_platform_role_id_idx" ON "users"("platform_role_id");
ALTER TABLE "users" ADD CONSTRAINT "users_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "platform_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD COLUMN "support_parent_id" UUID, ADD COLUMN "support_mode" VARCHAR(20), ADD COLUMN "support_reason" VARCHAR(240);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_support_parent_id_fkey" FOREIGN KEY ("support_parent_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_support_fields_check" CHECK (
  ("support_parent_id" IS NULL AND "support_mode" IS NULL AND "support_reason" IS NULL)
  OR ("support_parent_id" IS NOT NULL AND "support_parent_id" <> "id" AND "support_mode" IS NOT NULL AND "support_reason" IS NOT NULL AND "support_mode" IN ('READ_ONLY', 'MAINTENANCE') AND length("support_reason") BETWEEN 10 AND 240)
);
CREATE INDEX "sessions_support_parent_id_idx" ON "sessions"("support_parent_id");
INSERT INTO "platform_roles" ("id", "public_id", "name", "description", "permissions", "updated_at") VALUES
  (gen_random_uuid(), 'platform-technical', 'Equipe técnica', 'Consulta de usuários, diagnóstico e manutenção das lojas.', ARRAY['users.read','support.read','support.write','operations.read'], CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'platform-compliance', 'Compliance', 'Consulta de usuários, acesso de suporte somente leitura e auditoria.', ARRAY['users.read','support.read','audit.read'], CURRENT_TIMESTAMP);
