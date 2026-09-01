-- Email verification is now the activation gate. Existing verified accounts
-- that remained in the former manual review queue are activated once.
UPDATE "users"
SET "account_status" = 'APPROVED'
WHERE "account_status" = 'PENDING'
  AND "email_verified_at" IS NOT NULL;
