import test from 'node:test';
import assert from 'node:assert/strict';
import { untranslatedLiterals } from '../../scripts/check-language-release.mts';

test('release inventory finds static customer text but excludes class names, URLs, technical values and translated expressions', () => {
  const result = untranslatedLiterals(
    `
    export const Example = () => <section className="customer-form">
      <h1>Delivery email</h1>
      <input aria-label="Email address" placeholder="Enter your email" />
      <a href="/checkout">{'Continue to payment'}</a>
      <span>{t('checkout.title')}</span>
      <code>12345</code>
      <code>ICCID</code><span>Alozuri</span><code>SM-DP+</code>
      <span>配送メール</span>
    </section>;
  `,
    'fixture.tsx',
  );
  assert.deepEqual(
    result.map((item) => item.text),
    ['Delivery email', 'Email address', 'Enter your email', 'Continue to payment', '配送メール'],
  );
  assert.ok(result.every((item) => item.line > 0 && item.file === 'fixture.tsx'));
});
