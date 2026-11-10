export const WHCC_API_VERSION = '2026-10';
export const WHCC_SANDBOX_ORIGIN = 'https://apis-stage.whcc.com';
export const WHCC_LIVE_ORIGIN = 'https://apis.whcc.com';
export const WHCC_ORIGINS = Object.freeze({ test: WHCC_SANDBOX_ORIGIN, live: WHCC_LIVE_ORIGIN });
export const SHOPIFY_API_VERSION = '2026-10';

export function enabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

export function whccEnvironment(value) {
  const environment = String(value || 'test').trim().toLowerCase();
  if (!Object.hasOwn(WHCC_ORIGINS, environment)) throw new Error('WHCC_ENVIRONMENT must be test or live.');
  return environment;
}

export function assertWhccOrigin(url, environment = 'test') {
  const selected = whccEnvironment(environment);
  const parsed = new URL(url);
  if (parsed.origin !== WHCC_ORIGINS[selected]) {
    throw new Error(`Safety stop: WHCC ${selected} requests may only use ${WHCC_ORIGINS[selected]}.`);
  }
  return parsed;
}

export function assertSandboxOnly(url) {
  return assertWhccOrigin(url, 'test');
}

function orderAllowlist(value) {
  return new Set(String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean));
}

export function whccRuntime(env = {}) {
  const environment = whccEnvironment(env.WHCC_ENVIRONMENT);
  const origin = WHCC_ORIGINS[environment];
  const apiKey = environment === 'live'
    ? env.WHCC_LIVE_API_KEY
    : env.WHCC_TEST_API_KEY || env.WHCC_SANDBOX_API_KEY;
  return { environment, origin, apiBase: `${origin}/api`, apiKey };
}

export function submissionAuthorization(env = {}, orderId) {
  const { environment } = whccRuntime(env);
  const id = String(orderId || '');
  if (environment === 'test') {
    return {
      allowed: enabled(env.WHCC_TEST_SUBMIT_ENABLED || env.WHCC_SANDBOX_SUBMIT_ENABLED),
      environment,
      reason: 'WHCC_TEST_SUBMIT_ENABLED is off',
    };
  }

  if (!enabled(env.WHCC_LIVE_SUBMIT_ENABLED)) {
    return { allowed: false, environment, reason: 'WHCC_LIVE_SUBMIT_ENABLED is off' };
  }
  if (orderAllowlist(env.WHCC_LIVE_ORDER_IDS).has(id)) {
    return { allowed: true, environment, reason: 'order is explicitly allowlisted' };
  }
  if (enabled(env.WHCC_LIVE_FULL_ROLLOUT_ENABLED)) {
    return { allowed: true, environment, reason: 'full Live rollout is enabled' };
  }
  return { allowed: false, environment, reason: 'order is not allowlisted and full Live rollout is off' };
}
