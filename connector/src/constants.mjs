export const WHCC_API_VERSION = '2026-10';
export const WHCC_SANDBOX_ORIGIN = 'https://apis-stage.whcc.com';
export const WHCC_SANDBOX_API_BASE = `${WHCC_SANDBOX_ORIGIN}/api`;
export const SHOPIFY_API_VERSION = '2026-10';

export function enabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

export function assertSandboxOnly(url) {
  const parsed = new URL(url);
  if (parsed.origin !== WHCC_SANDBOX_ORIGIN) {
    throw new Error(`Safety stop: WHCC requests may only use ${WHCC_SANDBOX_ORIGIN}.`);
  }
  return parsed;
}
