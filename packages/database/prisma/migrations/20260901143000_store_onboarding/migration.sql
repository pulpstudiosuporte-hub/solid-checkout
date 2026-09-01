ALTER TABLE "stores"
ADD COLUMN "onboarding_completed_at" TIMESTAMPTZ(3);

-- Existing production stores were already operating before guided activation existed.
UPDATE "stores"
SET "onboarding_completed_at" = NOW()
WHERE "onboarding_completed_at" IS NULL;
