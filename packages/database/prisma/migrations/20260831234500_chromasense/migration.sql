CREATE TYPE "ChromaSenseEventType" AS ENUM ('VIEW', 'CLICK', 'MOVE', 'SCROLL', 'ATTENTION');

CREATE TABLE "chromasense_sessions" (
  "id" UUID NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "store_id" UUID NOT NULL,
  "checkout_id" UUID NOT NULL,
  "checkout_session_id" UUID NOT NULL,
  "page_key" VARCHAR(100) NOT NULL DEFAULT 'checkout',
  "device_type" VARCHAR(16) NOT NULL DEFAULT 'desktop',
  "viewport_width" INTEGER NOT NULL,
  "viewport_height" INTEGER NOT NULL,
  "event_count" INTEGER NOT NULL DEFAULT 0,
  "active_ms" INTEGER NOT NULL DEFAULT 0,
  "visible_ms" INTEGER NOT NULL DEFAULT 0,
  "max_scroll_percent" INTEGER NOT NULL DEFAULT 0,
  "rage_click_count" INTEGER NOT NULL DEFAULT 0,
  "dead_click_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "chromasense_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chromasense_events" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "type" "ChromaSenseEventType" NOT NULL,
  "x" DOUBLE PRECISION,
  "y" DOUBLE PRECISION,
  "scroll_percent" INTEGER,
  "duration_ms" INTEGER,
  "target" VARCHAR(160),
  "target_label" VARCHAR(120),
  "interactive" BOOLEAN,
  "rage" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chromasense_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chromasense_sessions_public_id_key" ON "chromasense_sessions"("public_id");
CREATE UNIQUE INDEX "chromasense_sessions_checkout_session_id_key" ON "chromasense_sessions"("checkout_session_id");
CREATE INDEX "chromasense_sessions_store_id_started_at_idx" ON "chromasense_sessions"("store_id", "started_at" DESC);
CREATE INDEX "chromasense_sessions_checkout_id_started_at_idx" ON "chromasense_sessions"("checkout_id", "started_at" DESC);
CREATE INDEX "chromasense_events_session_id_type_created_at_idx" ON "chromasense_events"("session_id", "type", "created_at");
CREATE INDEX "chromasense_events_created_at_idx" ON "chromasense_events"("created_at");

ALTER TABLE "chromasense_sessions" ADD CONSTRAINT "chromasense_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chromasense_sessions" ADD CONSTRAINT "chromasense_sessions_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chromasense_sessions" ADD CONSTRAINT "chromasense_sessions_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chromasense_events" ADD CONSTRAINT "chromasense_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chromasense_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
