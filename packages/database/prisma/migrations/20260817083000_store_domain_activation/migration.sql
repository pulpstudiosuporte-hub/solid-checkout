ALTER TABLE "store_domains" ADD COLUMN "dokploy_domain_id" VARCHAR(128);
ALTER TABLE "store_domains" ADD COLUMN "activated_at" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "store_domains_dokploy_domain_id_key" ON "store_domains"("dokploy_domain_id");
