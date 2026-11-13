import { z } from 'zod';
import { countryName, dataLabel } from '../../../../packages/shared/src/index.ts';
import { BUSINESS } from '../../../../packages/shared/src/legal.ts';
import {
  CONFIRMATION_VERSION,
  confirmationVersionSchema,
  confirmationHash,
  confirmationMoney,
  orderReference,
  type ConfirmationOrder,
} from './confirmation-order.js';

export const ORDER_EMAIL_FROM = 'Alozuri <orders@alozuri.com>';
export type InlineEmailImage = {
  filename: string;
  content: string;
  content_type: 'image/png';
  content_id: string;
};
export type InstallationEmailSection = {
  html: string;
  text: string;
  attachments: InlineEmailImage[];
};
export type ConfirmationEmail = {
  id: string;
  version?: z.infer<typeof confirmationVersionSchema>;
  email: string;
  url: string;
  text: string;
  html: string;
  attachments?: InlineEmailImage[];
};
export interface OrderMailer {
  send(input: ConfirmationEmail): Promise<{ providerMessageId: string }>;
  deliveryStatus(providerMessageId: string): Promise<string>;
}
export class EmailSendError extends Error {
  constructor(
    readonly reason: 'provider_unavailable' | 'provider_rejected' | 'idempotency_conflict',
  ) {
    super(reason);
  }
}
export const escapeEmailHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const e = escapeEmailHtml;
const paragraph = (text: string) =>
  `<p style="margin:0 0 14px;font-size:16px;line-height:1.65">${e(text)}</p>`;
const heading = (text: string) =>
  `<h2 style="margin:28px 0 12px;font-size:21px;line-height:1.3;color:#1b2035">${e(text)}</h2>`;
const detail = (label: string, value: string) =>
  `<p style="margin:0 0 8px;line-height:1.6"><strong>${e(label)}:</strong> ${e(value)}</p>`;
const countries = (item: ConfirmationOrder['items'][number]) =>
  item.plan.countries.map((code) => `${countryName(code)} (${code})`).join(', ');
const installationSteps = [
  'Connect your phone to Wi-Fi.',
  'Open your secure Alozuri order page.',
  'Scan the eSIM QR code or follow the manual installation instructions.',
  'Enable your Alozuri eSIM in your mobile settings.',
  'Turn on data roaming for the Alozuri eSIM if required.',
  "Connect to a supported network according to your plan's activation conditions.",
];
// Format only the immutable text snapshot. Preserve every line and numbered heading.
export function legalEmailHtml(text: string) {
  return text
    .split(/\n\n/)
    .map((block) => {
      const lines = block.split('\n');
      const first = lines[0] ?? '';
      return /^\d+\.\s/.test(first)
        ? `<h3 style="font-size:16px;line-height:1.5;margin:22px 0 8px">${e(first)}</h3>${lines.length > 1 ? `<p style="margin:0 0 14px">${lines.slice(1).map(e).join('<br>')}</p>` : ''}`
        : `<p style="margin:0 0 14px">${lines.map(e).join('<br>')}</p>`;
    })
    .join('');
}
export function confirmationEmail(
  order: ConfirmationOrder,
  url: string,
  version: z.infer<typeof confirmationVersionSchema> = 'email-v1',
  installation?: InstallationEmailSection,
): ConfirmationEmail {
  if (installation && version !== CONFIRMATION_VERSION)
    throw new Error('Installation details require a ready confirmation.');
  const steps = installation
    ? [
        installationSteps[0],
        'On your phone, open Settings → Mobile/Cellular → Add eSIM.',
        'Scan the QR code from another screen, or enter the SM-DP+ address and activation code manually.',
        ...installationSteps.slice(3),
      ]
    : installationSteps;
  const site = new URL(url).origin;
  const business = order.legal.business ?? BUSINESS;
  const reference = orderReference(order.id);
  const total = confirmationMoney(order.totalCents, order.currency);
  const termsVersion = order.legal.termsVersion ?? order.legal.version;
  const refundVersion = order.legal.refundVersion ?? order.legal.version;
  const pending =
    version === CONFIRMATION_VERSION
      ? 'Your eSIM is ready. Open your secure order page to view your QR code and manual installation details.'
      : 'Your order is processing. Your secure order page shows your order status and will display your eSIM QR code, manual installation details and activation information once provisioning is complete. Use the same link to return at any time.';
  const activationNote =
    'Before installing, check the actual activation rule below for each plan. Some plans begin on installation, first network connection or purchase; follow the rule recorded for your purchased plan.';
  const important =
    'Your device must support eSIM and be network-unlocked. Keep your QR code, installation details and private order link secure. Your recorded activation rule, validity, data allowance and fair-use restrictions are shown in your order summary above. Contact support@alozuri.com for help.';
  const promotionText = order.promotion
    ? `Original retail: ${confirmationMoney(order.originalRetailCents ?? order.totalCents, order.currency)}\nPromotion ${order.promotion.code} (${order.promotion.discountPercent}%): -${confirmationMoney(order.discountCents ?? 0, order.currency)}\n`
    : '';
  const summaryText = order.items
    .map((item) =>
      [
        `${item.quantity} × ${item.plan.name}`,
        `Included countries: ${countries(item)}`,
        `Data allowance: ${dataLabel(item.plan)}`,
        `Validity: ${item.plan.days} days`,
        `Activation: ${item.plan.activation}`,
        `Restrictions: ${item.plan.fairUse || 'No additional restriction recorded.'}`,
        ...(item.plan.supplierNotes ? [`Supplier conditions: ${item.plan.supplierNotes}`] : []),
        `Unit price: ${confirmationMoney(item.plan.priceCents, order.currency)}`,
        `Line total: ${confirmationMoney(item.plan.priceCents * item.quantity, order.currency)}`,
      ].join('\n'),
    )
    .join('\n\n');
  const tax =
    order.taxCents === undefined
      ? 'Tax was not recorded separately on this order.'
      : `Separately charged tax: ${confirmationMoney(order.taxCents, order.currency)}. No tax rate or VAT registration is recorded on this order.`;
  const contractMetadata = [
    `Order reference: ${reference}`,
    `Contract date and time: ${order.createdAt}`,
    `Payment confirmed at: ${order.paidAt}`,
    `Customer email: ${order.email}`,
    ...(order.customerName ? [`Customer name: ${order.customerName}`] : []),
    `Seller: ${business.company}, trading as ${business.brand}`,
    `Company number: ${business.number}`,
    `Registered office: ${business.address}`,
    `Contact: ${business.email}`,
    `Purchased plans: ${order.items.map(({ plan, quantity }) => `${quantity} × ${plan.name}`).join('; ')}`,
    'The plan details, countries, validity, activation conditions and restrictions in Your Order above form part of this purchase contract.',
    ...(promotionText ? [promotionText.trim()] : []),
    `Total paid: ${total}`,
    'Payment status: Paid',
    tax,
    `Legal acceptance timestamp: ${order.legal.acceptedAt}`,
    `Accepted Terms and Conditions version: ${termsVersion}`,
    `Accepted Refund and Cancellation Policy version: ${refundVersion}`,
    `Policy effective date: ${order.legal.effectiveDate}`,
    ...(order.legal.noticeText ? [order.legal.noticeText] : []),
    ...(order.legal.requestText ? [order.legal.requestText] : []),
    ...(order.legal.acknowledgementText ? [order.legal.acknowledgementText] : []),
  ];
  const footerText = `Alozuri — One eSIM. Every stop.\n${business.company}\nCompany number ${business.number}\n${business.address}\n${business.email}\nTerms: ${site}/terms\nPrivacy Policy: ${site}/privacy\nCookie Policy: ${site}/cookies\nRefund Policy: ${site}/refund-policy\nContact: ${site}/contact`;
  const text = `Your order is confirmed!\n\nThank you for choosing Alozuri. Access your eSIM through your secure order page.\n\nYOUR ORDER\nOrder reference: ${reference}\nPurchase date and time: ${order.paidAt}\n\n${summaryText}\n\n${promotionText}Total paid: ${total}\nPayment status: Paid\n${tax}\n\nACCESS YOUR ESIM\nView & Install Your eSIM:\n${url}\n\n${pending}\n\nINSTALLATION\n${installation ? installation.text + '\n\n' : ''}${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n${activationNote}\n${order.items.map(({ plan }) => `${plan.name}: ${plan.activation} Validity: ${plan.days} days.`).join('\n')}\n\nCompatibility and installation guide: ${site}/esim-compatibility\n\nIMPORTANT INFORMATION\n${important}\n\nYour Purchase Contract\n${contractMetadata.join('\n')}\n\nTERMS AND CONDITIONS\n${order.legal.termsText}\n\nREFUND AND CANCELLATION POLICY\n${order.legal.refundText}\n\n${footerText}`;
  const summaryHtml = order.items
    .map(
      (item) =>
        `<div style="padding:14px 0;border-top:1px solid #dddbea"><h3 style="font-size:17px;margin:0 0 12px">${item.quantity} × ${e(item.plan.name)}</h3>${detail('Included countries', countries(item))}${detail('Data allowance', dataLabel(item.plan))}${detail('Validity', `${item.plan.days} days`)}${detail('Activation', item.plan.activation)}${detail('Restrictions', item.plan.fairUse || 'No additional restriction recorded.')}${item.plan.supplierNotes ? detail('Supplier conditions', item.plan.supplierNotes) : ''}${detail('Unit price', confirmationMoney(item.plan.priceCents, order.currency))}${detail('Line total', confirmationMoney(item.plan.priceCents * item.quantity, order.currency))}</div>`,
    )
    .join('');
  const contractHtml = `<section aria-label="Your Purchase Contract" style="border-top:1px solid #dddbea;margin-top:32px;padding-top:8px">${heading('Your Purchase Contract')}<div style="font-size:14px;line-height:1.7;color:#41495e">${contractMetadata.map((line) => `<p style="margin:0 0 8px">${e(line)}</p>`).join('')}${heading('Terms and Conditions')}${legalEmailHtml(order.legal.termsText)}${heading('Refund and Cancellation Policy')}${legalEmailHtml(order.legal.refundText)}</div></section>`;
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Your Alozuri eSIM order confirmation</title></head><body style="margin:0;background:#f6f6fb;font-family:Inter,Arial,sans-serif;color:#1b2035"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e3ed;border-radius:16px"><tr><td style="padding:28px 24px;overflow-wrap:anywhere;word-break:break-word"><img src="${e(site)}/images/alozuri-email-logo.png" width="132" height="40" alt="Alozuri" style="display:block;border:0;object-fit:contain;object-position:center;padding:10px 16px;border-radius:12px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);box-sizing:content-box"><h1 style="font-size:26px;line-height:1.25;margin:24px 0 12px">Your order is confirmed!</h1>${paragraph('Thank you for choosing Alozuri. Access your eSIM through your secure order page.')}${heading('Your Order')}<div style="background:#f5f4ff;border-radius:10px;padding:16px;font-size:15px;line-height:1.65">${detail('Order reference', reference)}${detail('Purchase date and time', order.paidAt)}${summaryHtml}${order.promotion ? detail('Original retail', confirmationMoney(order.originalRetailCents ?? order.totalCents, order.currency)) + detail('Promotion ' + order.promotion.code, '-' + confirmationMoney(order.discountCents ?? 0, order.currency)) : ''}${detail('Total paid', total)}${detail('Payment status', 'Paid')}<p style="font-size:14px;margin:0">${e(tax)}</p></div>${heading('Access your eSIM')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#4b3dcc" style="border-radius:10px"><a href="${e(url)}" style="display:block;padding:16px 12px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;line-height:1.5">View &amp; Install Your eSIM</a></td></tr></table><div style="margin-top:16px">${paragraph(pending)}</div>${heading('Install when you are ready')}${installation?.html ?? ''}<ol style="padding-left:22px;font-size:16px;line-height:1.65;margin:0 0 16px">${steps.map((step) => `<li style="margin-bottom:8px">${e(step)}</li>`).join('')}</ol>${paragraph(activationNote)}${order.items.map(({ plan }) => detail(plan.name, `${plan.activation} Validity: ${plan.days} days.`)).join('')}<p style="font-size:16px;line-height:1.65"><a href="${e(site)}/esim-compatibility" style="color:#4b3dcc">eSIM compatibility and installation guide</a></p>${heading('Important information')}${paragraph(important)}${contractHtml}<div style="border-top:1px solid #dddbea;margin-top:28px;padding-top:20px;font-size:14px;line-height:1.8;color:#656d83"><strong>Alozuri — One eSIM. Every stop.</strong><br>${e(business.company)}<br>Company number ${e(business.number)}<br>${e(business.address)}<br><a href="mailto:${e(business.email)}" style="color:#4b3dcc">${e(business.email)}</a><p style="margin-top:14px">${[
    ['Terms', '/terms'],
    ['Privacy Policy', '/privacy'],
    ['Cookie Policy', '/cookies'],
    ['Refund Policy', '/refund-policy'],
    ['Contact', '/contact'],
  ]
    .map(
      ([label, path]) =>
        `<a href="${e(site + path)}" style="display:inline-block;padding:6px 8px 6px 0;color:#4b3dcc">${label}</a>`,
    )
    .join(' ')}</p></div></td></tr></table></td></tr></table></body></html>`;
  return {
    id: order.id,
    version,
    email: order.email,
    url,
    text,
    html,
    ...(installation ? { attachments: installation.attachments } : {}),
  };
}
export function confirmationPayload(input: ConfirmationEmail) {
  return {
    from: ORDER_EMAIL_FROM,
    to: [input.email],
    reply_to: 'support@alozuri.com',
    subject: 'Your Alozuri eSIM order confirmation',
    text: input.text,
    html: input.html,
    ...(input.attachments?.length
      ? {
          attachments: input.attachments.map((image) => ({
            filename: image.filename,
            content: image.content,
            content_type: image.content_type,
            content_id: image.content_id,
          })),
        }
      : {}),
  };
}
export const confirmationPayloadHash = (input: ConfirmationEmail) =>
  confirmationHash(JSON.stringify(confirmationPayload(input)));
export class ResendOrderMailer implements OrderMailer {
  constructor(private key: string) {}
  async send(input: ConfirmationEmail) {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${input.id}:confirmation:${input.version ?? 'email-v1'}`,
        },
        body: JSON.stringify(confirmationPayload(input)),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new EmailSendError('provider_unavailable');
    }
    if (!response.ok)
      throw new EmailSendError(
        response.status === 409
          ? 'idempotency_conflict'
          : response.status >= 500 || response.status === 429
            ? 'provider_unavailable'
            : 'provider_rejected',
      );
    return {
      providerMessageId: z.object({ id: z.string().min(1).max(200) }).parse(await response.json())
        .id,
    };
  }
  async deliveryStatus(providerMessageId: string) {
    const response = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(providerMessageId)}`,
      {
        headers: { Authorization: `Bearer ${this.key}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error('Email delivery status unavailable.');
    return z.object({ last_event: z.string().min(1).max(50) }).parse(await response.json())
      .last_event;
  }
}
