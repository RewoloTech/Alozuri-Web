import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import {
  sampleConfirmation,
  sampleInstallations,
} from '../../../tests/fixtures/order-confirmation.ts';
import { installationConfirmationEmail } from '../src/lib/order-email-installation.ts';
import {
  confirmationPayload,
  confirmationPayloadHash,
  ResendOrderMailer,
} from '../src/lib/order-email.ts';

const url = 'https://alozuri.com/checkout/success?order=sample#access=synthetic-private-token';
test('ready email embeds a scannable PNG and matching manual details for every purchased eSIM', async () => {
  const order = sampleConfirmation();
  const units = sampleInstallations(order);
  const email = await installationConfirmationEmail(order, url, units);
  const payload = confirmationPayload(email);
  assert.equal(payload.attachments?.length, 2);
  assert(
    email.html.indexOf('cid:alozuri-esim-1') > email.html.indexOf('Install when you are ready'),
  );
  assert(email.html.indexOf('cid:alozuri-esim-2') < email.html.indexOf('Your Purchase Contract'));
  assert(email.html.includes('Settings → Mobile/Cellular → Add eSIM'));
  assert(email.text.includes('Do not delete the eSIM'));
  assert(email.html.includes('src="cid:alozuri-esim-1"'));
  assert(!email.html.includes('data:image'));
  assert(email.html.includes(url.replaceAll('&', '&amp;')));
  for (const [index, image] of (payload.attachments ?? []).entries()) {
    assert.equal(image.content_type, 'image/png');
    assert.equal(image.filename, `alozuri-esim-${index + 1}.png`);
    assert.equal(image.content_id, `alozuri-esim-${index + 1}`);
    const png = PNG.sync.read(Buffer.from(image.content, 'base64'));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, units[index].activation.ac);
    const [, host, code, confirmation] = units[index].activation.ac.split('$');
    for (const value of [
      host,
      code,
      units[index].activation.iccid,
      ...(confirmation ? [confirmation] : []),
    ]) {
      assert(email.text.includes(value));
      assert(email.html.includes(value));
      assert(!email.text.split('Your Purchase Contract')[1].includes(value));
    }
    assert(!email.text.includes(units[index].activation.esimTranNo));
    assert(!email.html.includes(units[index].activation.esimTranNo));
  }
  assert(Buffer.byteLength(email.html) < 100_000);
  assert(email.text.includes(order.legal.termsText));
  assert(email.text.includes(order.legal.refundText));
});
test('QR email payloads are deterministic and reject missing, duplicate or foreign plan units', async () => {
  const order = sampleConfirmation();
  const units = sampleInstallations(order);
  const first = await installationConfirmationEmail(order, url, units);
  const second = await installationConfirmationEmail(order, url, [...units].reverse());
  assert.deepEqual(confirmationPayload(first), confirmationPayload(second));
  for (const bad of [
    units.slice(0, 1),
    [units[0], units[0]],
    [...units, { ...units[0], unitId: 'order_' + 'f'.repeat(48) }],
    [{ ...units[0], planId: 'not-purchased' }, units[1]],
    [{ ...units[0], activation: { ...units[0].activation, ac: 'invalid' } }, units[1]],
  ])
    await assert.rejects(installationConfirmationEmail(order, url, bad));
  const changed = structuredClone(units);
  changed[0].activation.ac = 'LPA:1$rsp.example.test$DIFFERENT-SYNTHETIC';
  assert.notEqual(
    confirmationPayloadHash(first),
    confirmationPayloadHash(await installationConfirmationEmail(order, url, changed)),
  );
});
test('manual activation fields and plan titles cannot inject email HTML', async () => {
  const order = sampleConfirmation();
  order.items[0].plan.name = '<script>alert(1)</script>';
  const units = sampleInstallations(order);
  units[0].activation.ac = 'LPA:1$rsp.example.test$<script>alert(2)</script>';
  const email = await installationConfirmationEmail(order, url, units);
  assert(!email.html.includes('<script>'));
  assert(email.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert(email.html.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
});
test('Resend receives private PNG content with CID references and the established per-order key', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const email = await installationConfirmationEmail(
    sampleConfirmation(),
    url,
    sampleInstallations(),
  );
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    requests++;
    assert.equal(String(input), 'https://api.resend.com/emails');
    assert.equal(
      new Headers(init?.headers).get('Idempotency-Key'),
      `${email.id}:confirmation:email-v2-ready`,
    );
    assert.deepEqual(JSON.parse(String(init?.body)), confirmationPayload(email));
    assert(!JSON.parse(String(init?.body)).attachments.some((a: { path?: string }) => a.path));
    return Response.json({ id: 'synthetic-provider-id' });
  };
  await new ResendOrderMailer('synthetic-key').send(email);
  assert.equal(requests, 1);
});

test('a ten-eSIM purchase retains a distinct QR attachment and manual block for every unit', async () => {
  const order = sampleConfirmation();
  order.items = [
    { ...order.items[0], quantity: 5 },
    {
      plan: { ...order.items[0].plan, id: 'second-synthetic-plan', name: 'Second plan' },
      quantity: 5,
    },
  ];
  order.subtotalCents = order.totalCents = order.items.reduce(
    (total, item) => total + item.quantity * item.plan.priceCents,
    0,
  );
  const units = sampleInstallations(order);
  const email = await installationConfirmationEmail(order, url, units);
  assert.equal(email.attachments?.length, 10);
  assert.equal(new Set(email.attachments?.map((image) => image.content_id)).size, 10);
  for (const unit of units) assert(email.text.includes(unit.activation.iccid));
  assert(email.html.includes('cid:alozuri-esim-10'));
  assert(Buffer.byteLength(email.html) < 100_000);
});
