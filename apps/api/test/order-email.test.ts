import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleConfirmation } from '../../../tests/fixtures/order-confirmation.ts';
import { confirmationOrderSchema, orderReference } from '../src/lib/confirmation-order.ts';
import {
  confirmationEmail,
  confirmationPayload,
  confirmationPayloadHash,
  ResendOrderMailer,
  EmailSendError,
  legalEmailHtml,
} from '../src/lib/order-email.ts';

const url = 'https://alozuri.com/checkout/success?order=sample#access=private-fixture-token';
test('confirmation input selects recorded fields and rejects unverified dates, currencies and totals', () => {
  const source = sampleConfirmation();
  assert.deepEqual(
    confirmationOrderSchema.parse({
      ...source,
      accessToken: 'private',
      ac: 'LPA:1$secret',
      cardNumber: '4242',
    }),
    source,
  );
  assert.equal('customerName' in source, false);
  assert.throws(() => confirmationOrderSchema.parse({ ...source, totalCents: 1 }));
  assert.throws(() => confirmationOrderSchema.parse({ ...source, currency: 'EUR' }));
  assert.throws(() => confirmationOrderSchema.parse({ ...source, paidAt: undefined }));
  assert.throws(() => confirmationOrderSchema.parse({ ...source, legal: undefined }));
  assert.equal(
    confirmationOrderSchema.parse({ ...source, taxCents: 100, totalCents: source.totalCents + 100 })
      .taxCents,
    100,
  );
  assert.match(orderReference(source.id), /^AZ-(?:[A-F0-9]{4}-){3}[A-F0-9]{4}$/);
});
test('one complete email preserves accepted terms, real dates and charged currencies without attachments', () => {
  for (const currency of ['USD', 'GBP', 'EUR'] as const) {
    const source = sampleConfirmation(currency);
    const email = confirmationEmail(source, url);
    assert.ok(email.text.includes(`Total paid: ${currency} 38.98`));
    assert.ok(email.text.includes(source.legal.termsText));
    assert.ok(email.text.includes(source.legal.refundText));
    assert.ok(email.text.includes('Purchase date and time: ' + source.paidAt));
    assert.ok(email.text.includes('Legal acceptance timestamp: ' + source.legal.acceptedAt));
    assert.ok(email.text.includes('Your order is processing.'));
    assert.ok(!email.text.includes('eSIM is ready'));
    const contract = email.text.split('Your Purchase Contract')[1];
    assert.ok(contract && !contract.includes('private-fixture-token'));
    assert.ok(!contract.includes('Customer name:'));
    assert.ok(email.html.includes('View &amp; Install Your eSIM'));
    assert.ok(email.html.includes('1. About Alozuri'));
    assert.ok(email.html.includes('I wish to cancel my Alozuri order'));
    assert.ok(
      Buffer.byteLength(email.html) < 100_000,
      'Keep ordinary confirmations below Gmail clipping size.',
    );
    const payload = confirmationPayload(email);
    assert.equal(payload.from, 'Alozuri <orders@alozuri.com>');
    assert.equal(payload.subject, 'Your Alozuri eSIM order confirmation');
    assert.equal('attachments' in payload, false);
    const changed = confirmationEmail(
      { ...source, legal: { ...source.legal, termsText: 'Later terms' } },
      url,
    );
    assert.notEqual(confirmationPayloadHash(email), confirmationPayloadHash(changed));
  }
});
test('email escapes untrusted plan text and preserves complete policy lines and section numbers', () => {
  const source = sampleConfirmation();
  source.items[0].plan.name = '<script>alert("bad")</script>';
  const email = confirmationEmail(source, url);
  assert.ok(!email.html.includes('<script>'));
  assert.ok(email.html.includes('&lt;script&gt;'));
  const policy = '1. A heading\nKeep <all> & every line.\n\n2. Cancellation\nI wish to cancel.';
  const html = legalEmailHtml(policy);
  assert.ok(html.includes('1. A heading</h3>'));
  assert.ok(html.includes('Keep &lt;all&gt; &amp; every line.'));
  assert.ok(html.includes('2. Cancellation</h3>'));
  assert.ok(html.includes('I wish to cancel.'));
});
test('Resend receives one stable idempotency key and complete HTML/text, with controlled provider errors', async (t) => {
  const fetcher = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = fetcher;
  });
  const email = confirmationEmail(sampleConfirmation(), url);
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    requests++;
    if (init?.method === 'POST') {
      assert.equal(String(input), 'https://api.resend.com/emails');
      assert.equal(
        new Headers(init.headers).get('Idempotency-Key'),
        email.id + ':confirmation:email-v1',
      );
      assert.deepEqual(JSON.parse(String(init.body)), confirmationPayload(email));
      return Response.json({ id: 'provider-fixture' });
    }
    return Response.json({ last_event: 'delivered' });
  };
  const mailer = new ResendOrderMailer('test-fixture');
  assert.equal((await mailer.send(email)).providerMessageId, 'provider-fixture');
  assert.equal(await mailer.deliveryStatus('provider-fixture'), 'delivered');
  assert.equal(requests, 2);
  globalThis.fetch = async () =>
    Response.json({ error: 'private provider response' }, { status: 409 });
  await assert.rejects(
    mailer.send(email),
    (error: unknown) => error instanceof EmailSendError && error.reason === 'idempotency_conflict',
  );
});

test('ready email promises installation only with the ready version and uses its own idempotency key', async (t) => {
  const email = confirmationEmail(sampleConfirmation(), url, 'email-v2-ready');
  assert(email.text.includes('Your eSIM is ready.'));
  assert(!email.html.includes('Your order is processing.'));
  assert(email.html.includes('View &amp; Install Your eSIM'));
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (_url, init) => {
    assert.equal(
      new Headers(init?.headers).get('Idempotency-Key'),
      email.id + ':confirmation:email-v2-ready',
    );
    return Response.json({ id: 'ready-provider-fixture' });
  };
  await new ResendOrderMailer('test-fixture').send(email);
});
