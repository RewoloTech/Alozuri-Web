import test from 'node:test';
import assert from 'node:assert/strict';
import { privacyChoice, readPrivacyChoice, CONSENT_MAX_AGE } from '../src/privacy.ts';
import { BUSINESS, LEGAL_VERSION } from '../src/legal.ts';
import { POLICIES, policyText } from '../src/policies.ts';
test('consent defaults to refusal for absent, malformed, expired, future and obsolete records', () => {
  const now = Date.parse('2026-11-11T12:00:00Z'),
    encode = (v: unknown) => encodeURIComponent(JSON.stringify(v));
  for (const raw of [
    null,
    '',
    '%broken',
    encode({}),
    encode({ ...privacyChoice(true, now), version: 'old' }),
    encode(privacyChoice(true, now + 1)),
    encode(privacyChoice(true, now - CONSENT_MAX_AGE * 1000)),
  ])
    assert.equal(readPrivacyChoice(raw, now), null);
  assert.equal(readPrivacyChoice(encode(privacyChoice(false, now)), now)?.support, false);
  assert.equal(readPrivacyChoice(encode(privacyChoice(true, now)), now)?.support, true);
});
test('all seven policy documents have stable routes, substantive sections and verified company identity', () => {
  assert.equal(Object.keys(POLICIES).length, 7);
  assert.equal(POLICIES.terms.sections.length, 36);
  for (const policy of Object.values(POLICIES)) {
    assert.ok(policy.path.startsWith('/'));
    assert.ok(policy.sections.length >= 5);
    assert.ok(policyText(policy).includes(BUSINESS.company));
    assert.ok(policyText(policy).includes(LEGAL_VERSION));
  }
});
