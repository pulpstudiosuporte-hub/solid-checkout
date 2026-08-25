CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users"
ADD COLUMN "account_status" "AccountStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "platform_admin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "platform_admin" = true
WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);

ALTER TABLE "users" ALTER COLUMN "account_status" SET DEFAULT 'PENDING';
CREATE INDEX "users_account_status_created_at_idx" ON "users"("account_status", "created_at" DESC);
