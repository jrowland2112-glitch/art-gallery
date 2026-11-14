import { enabled } from './constants.mjs';

export function finerworksTestAuthorization(env = {}) {
  return {
    allowed: enabled(env.FINERWORKS_TEST_SUBMIT_ENABLED),
    environment: 'test',
    reason: 'FINERWORKS_TEST_SUBMIT_ENABLED is off',
  };
}

export function assertFinerworksTestEnvironment(env = {}) {
  if (String(env.FINERWORKS_ENVIRONMENT || 'test').trim().toLowerCase() !== 'test') {
    throw new Error('Safety stop: this Worker supports FinerWorks Test only.');
  }
  return 'test';
}
