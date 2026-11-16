import { enabled } from './constants.mjs';

export function finerworksEnvironment(env = {}) {
  const environment = String(env.FINERWORKS_ENVIRONMENT || 'test').trim().toLowerCase();
  if (!['test', 'live'].includes(environment)) throw new Error('FINERWORKS_ENVIRONMENT must be test or live.');
  return environment;
}

function orderAllowlist(value) {
  return new Set(String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean));
}

export function finerworksSubmissionAuthorization(env = {}, orderId) {
  const environment = finerworksEnvironment(env);
  if (environment === 'test') return finerworksTestAuthorization(env);
  if (!enabled(env.FINERWORKS_LIVE_SUBMIT_ENABLED)) {
    return { allowed: false, environment, reason: 'FINERWORKS_LIVE_SUBMIT_ENABLED is off' };
  }
  if (String(env.FINERWORKS_LIVE_PAYMENT_METHOD || '').trim().toLowerCase() !== 'account_default') {
    return { allowed: false, environment, reason: 'FINERWORKS_LIVE_PAYMENT_METHOD is not account_default' };
  }
  const id = String(orderId || '');
  if (orderAllowlist(env.FINERWORKS_LIVE_ORDER_IDS).has(id)) {
    return { allowed: true, environment, reason: 'order is explicitly allowlisted' };
  }
  if (enabled(env.FINERWORKS_LIVE_FULL_ROLLOUT_ENABLED)) {
    return { allowed: true, environment, reason: 'full Live rollout is enabled' };
  }
  return { allowed: false, environment, reason: 'order is not allowlisted and full Live rollout is off' };
}

export function finerworksTestAuthorization(env = {}) {
  return {
    allowed: enabled(env.FINERWORKS_TEST_SUBMIT_ENABLED),
    environment: 'test',
    reason: 'FINERWORKS_TEST_SUBMIT_ENABLED is off',
  };
}

export function assertFinerworksTestEnvironment(env = {}) {
  if (finerworksEnvironment(env) !== 'test') {
    throw new Error('Safety stop: this Worker supports FinerWorks Test only.');
  }
  return 'test';
}
