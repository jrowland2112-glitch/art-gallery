import { assertWhccOrigin, WHCC_API_VERSION, WHCC_ORIGINS, whccEnvironment } from './constants.mjs';

function problemMessage(payload, status) {
  const detail = payload?.detail || payload?.title || payload?.message;
  const invalid = payload?.invalidParams?.map((entry) => `${entry.name}: ${entry.reason}`).join('; ');
  return [detail || `WHCC request failed (${status})`, invalid].filter(Boolean).join(' — ');
}

export function createWhccClient({ apiKey, environment = 'test', fetchImpl = fetch }) {
  const selected = whccEnvironment(environment);
  if (!apiKey) throw new Error(`The WHCC ${selected} API key is not configured in the secret manager.`);
  const apiBase = `${WHCC_ORIGINS[selected]}/api`;

  async function request(pathOrUrl, { method = 'GET', body, idempotencyKey } = {}) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${apiBase}${pathOrUrl}`;
    assertWhccOrigin(url, selected);
    const headers = {
      authorization: `Bearer ${apiKey}`,
      'whcc-api-version': WHCC_API_VERSION,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const response = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(problemMessage(payload, response.status));
    return payload;
  }

  return {
    discovery: () => request('/v1/discovery'),
    catalog: (cursor) => request(`/v1/catalog/products${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
    product: (ref) => request(`/v1/catalog/products/${encodeURIComponent(ref)}`),
    build: (configuredProducts) => request('/v1/commerce/configured-products', { method: 'POST', body: { configuredProducts } }),
    poll: (configuredProductIds) => request(`/v1/commerce/configured-products?ids=${configuredProductIds.map(encodeURIComponent).join(',')}`),
    calculate: (submission) => request('/v1/commerce/submissions/calculate', { method: 'POST', body: submission }),
    submit: (submission, idempotencyKey) => request('/v1/commerce/submissions', { method: 'POST', body: submission, idempotencyKey }),
    submission: (id) => request(`/v1/commerce/submissions/${encodeURIComponent(id)}`),
  };
}

export function createWhccSandboxClient(options) {
  return createWhccClient({ ...options, environment: 'test' });
}
