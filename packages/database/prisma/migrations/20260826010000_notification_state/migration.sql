CREATE TABLE "notification_states" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "last_read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_states_user_id_store_id_key" ON "notification_states"("user_id", "store_id");
CREATE INDEX "notification_states_store_id_last_read_at_idx" ON "notification_states"("store_id", "last_read_at");
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
