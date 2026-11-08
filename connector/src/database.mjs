export async function first(db, sql, ...params) {
  return db.prepare(sql).bind(...params).first();
}

export async function all(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  return result.results || [];
}

export async function run(db, sql, ...params) {
  return db.prepare(sql).bind(...params).run();
}

export async function recordWebhook(db, { id, topic, shop, orderId }) {
  const result = await run(
    db,
    `INSERT OR IGNORE INTO webhook_events (id, topic, shop, order_id, status, received_at)
     VALUES (?, ?, ?, ?, 'received', datetime('now'))`,
    id, topic, shop, String(orderId),
  );
  return Number(result.meta?.changes || 0) === 1;
}

export async function updateJob(db, orderId, status, fields = {}) {
  const names = Object.keys(fields);
  const assignments = ['status = ?', ...names.map((name) => `${name} = ?`), "updated_at = datetime('now')"];
  await run(db, `UPDATE fulfillment_jobs SET ${assignments.join(', ')} WHERE order_id = ?`, status, ...names.map((name) => fields[name]), String(orderId));
}
