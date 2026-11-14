CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  shop TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fulfillment_jobs (
  order_id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL UNIQUE,
  order_name TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient_json TEXT NOT NULL,
  line_items_json TEXT NOT NULL,
  request_json TEXT,
  validation_json TEXT,
  status_json TEXT,
  finerworks_order_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fulfillment_jobs_status ON fulfillment_jobs(status);
