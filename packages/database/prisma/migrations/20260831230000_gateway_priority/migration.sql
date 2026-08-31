ALTER TABLE "gateway_connections"
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "store_id"
    ORDER BY CASE WHEN "provider" = 'ROAS' THEN 0 ELSE 1 END, "created_at"
  ) AS position
  FROM "gateway_connections"
  WHERE "active" = TRUE AND "provider" IN ('ROAS', 'WESTPAY')
)
UPDATE "gateway_connections" AS connection
SET "priority" = CASE WHEN ranked.position = 1 THEN 0 ELSE 100 END
FROM ranked
WHERE connection."id" = ranked."id";

CREATE INDEX "gateway_connections_store_id_active_priority_idx"
ON "gateway_connections"("store_id", "active", "priority");
