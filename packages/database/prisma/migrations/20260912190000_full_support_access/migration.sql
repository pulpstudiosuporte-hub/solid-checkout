ALTER TABLE "sessions" DROP CONSTRAINT "sessions_support_fields_check";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_support_fields_check" CHECK (
  ("support_parent_id" IS NULL AND "support_mode" IS NULL AND "support_reason" IS NULL)
  OR ("support_parent_id" IS NOT NULL AND "support_parent_id" <> "id" AND "support_mode" IS NOT NULL AND "support_reason" IS NOT NULL AND "support_mode" IN ('READ_ONLY', 'MAINTENANCE', 'FULL_ACCESS') AND length("support_reason") BETWEEN 10 AND 240)
);
