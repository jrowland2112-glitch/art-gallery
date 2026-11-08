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
  shipping_json TEXT NOT NULL,
  line_items_json TEXT NOT NULL,
  calculation_json TEXT,
  whcc_submission_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS configured_items (
  order_id TEXT NOT NULL,
  line_item_id TEXT NOT NULL,
  configured_product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (order_id, line_item_id),
  FOREIGN KEY (order_id) REFERENCES fulfillment_jobs(order_id)
);

CREATE TABLE IF NOT EXISTS whcc_events (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  confirmation_id TEXT,
  sequence_number TEXT,
  order_number TEXT,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fulfillment_jobs_status ON fulfillment_jobs(status);
