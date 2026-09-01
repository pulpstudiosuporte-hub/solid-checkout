ALTER TABLE "users" ADD COLUMN "profile" JSONB;
ALTER TABLE "stores" ADD COLUMN "profile" JSONB;
ALTER TABLE "notification_states" ADD COLUMN "preferences" JSONB;
