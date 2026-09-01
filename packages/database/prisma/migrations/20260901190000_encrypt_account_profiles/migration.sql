ALTER TABLE "users" ADD COLUMN "profile_encrypted" TEXT;
ALTER TABLE "stores" ADD COLUMN "profile_encrypted" TEXT;

-- Existing JSON profiles are migrated lazily by the API because PostgreSQL
-- does not have access to APP_ENCRYPTION_KEY. The API removes sensitive keys
-- from each legacy JSON row atomically when that profile is next accessed.
