ALTER TABLE "push_subscriptions" ADD COLUMN "session_id" UUID;
CREATE INDEX "push_subscriptions_session_id_idx" ON "push_subscriptions"("session_id");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
