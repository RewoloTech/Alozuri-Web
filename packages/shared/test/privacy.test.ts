import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { privacyChoice, readPrivacyChoice, CONSENT_MAX_AGE } from '../src/privacy.ts';
import { BUSINESS, LEGAL_VERSION } from '../src/legal.ts';
import { POLICIES, POLICY_VERSIONS, policyText } from '../src/policies.ts';
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
  assert.ok(POLICIES.terms.sections.length >= 15 && POLICIES.terms.sections.length <= 18);
  for (const policy of Object.values(POLICIES)) {
    assert.ok(policy.path.startsWith('/'));
    assert.ok(policy.sections.length >= 4);
    assert.ok(policyText(policy).includes(BUSINESS.company));
    assert.ok(policyText(policy).includes(LEGAL_VERSION));
  }
});
test('historic policy objects are retained unchanged and extended content is included in plain-text copies', () => {
  const expected = {
    '2026-11-11.1': 'f7bf3483e109241464ca541c9f01a913e9d2b5b888e5065790f19967cf207439',
    '2026-11-11.2': 'cb44d25f142d39860d470e389964e04e78fd7d1c75b5be3d5672f86aaf6d3f08',
  };
  for (const [version, digest] of Object.entries(expected))
    assert.equal(
      createHash('sha256').update(JSON.stringify(POLICY_VERSIONS[version])).digest('hex'),
      digest,
    );
  const cookies = policyText(POLICIES.cookies);
  assert.ok(cookies.includes('Cookies and browser storage used by Alozuri'));
  assert.ok(cookies.includes('__stripe_sid'));
  assert.ok(cookies.includes('30 minutes'));
  assert.ok(policyText(POLICIES.compatibility).includes('1. Open Settings'));
  assert.ok(policyText(POLICIES.terms).includes('https://alozuri.com/refund-policy'));
});
test('legal sections, inventory columns and resources are coherent and link to existing policies', () => {
  const internal = new Set(Object.values(POLICIES).map((policy) => policy.path));
  for (const policy of Object.values(POLICIES)) {
    assert.equal(
      new Set(policy.sections.map((section) => section.title)).size,
      policy.sections.length,
    );
    for (const section of policy.sections) {
      if (section.table)
        for (const row of section.table.rows)
          assert.equal(row.length, section.table.headings.length);
      for (const link of section.links ?? []) {
        assert.ok(link.label.trim());
        assert.ok(link.href.startsWith('https://') || internal.has(link.href), link.href);
      }
    }
  }
  const refunds = policyText(POLICIES.refunds);
  assert.ok(refunds.includes('14 days'));
  assert.ok(refunds.includes('does not by itself waive'));
  assert.ok(refunds.includes('not treated as such an express request'));
  assert.ok(refunds.includes('original payment method'));
  assert.doesNotMatch(
    policyText(POLICIES.contact),
    /we (?:are exempt|belong to|are a member)|24\/7|within \d+ hours/i,
  );
});
