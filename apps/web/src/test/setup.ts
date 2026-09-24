import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { deleteCookie, setCookie } from '../lib/cookies';

// Por defecto el tutorial ya está cerrado; los tests del tutorial borran la cookie.
beforeEach(() => {
  deleteCookie('hz_onboarding_done');
  setCookie('hz_onboarding_done', '1', 365);
});
