CREATE TABLE "store_domains" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "store_id" UUID NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING_DNS',
    "verified_at" TIMESTAMPTZ(3),
    "last_checked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "store_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "store_domains_public_id_key" ON "store_domains"("public_id");
CREATE UNIQUE INDEX "store_domains_store_id_key" ON "store_domains"("store_id");
CREATE UNIQUE INDEX "store_domains_hostname_key" ON "store_domains"("hostname");
CREATE INDEX "store_domains_status_idx" ON "store_domains"("status");

ALTER TABLE "store_domains" ADD CONSTRAINT "store_domains_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
