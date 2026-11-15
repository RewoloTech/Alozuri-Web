import { afterEach, expect, test } from '@jest/globals';
import { endorselyReferral } from '../../apps/web/src/lib/endorsely';

afterEach(() => {
  delete window.endorsely_referral;
});

test.each([undefined, null, '', 'invalid', 42, {}, 'a'.repeat(1000)])(
  'omits an unavailable or invalid referral (%p)',
  (value) => {
    window.endorsely_referral = value;
    expect(endorselyReferral()).toBeUndefined();
  },
);

test('reads the current referral at submission time', () => {
  expect(endorselyReferral()).toBeUndefined();
  window.endorsely_referral = 'a635b2bf-c05b-450c-ab6c-b0babb3ed446';
  expect(endorselyReferral()).toBe(window.endorsely_referral);
});
