import { transactionLocale } from './transaction-locale.js';
import { z } from 'zod';
import { transactionCopy } from '../../../../packages/shared/src/i18n/transaction-copy.ts';
import { englishMessages, type Messages } from '../../../../packages/shared/src/i18n/messages.ts';
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
  subject?: string;
  from?: string;
  replyTo?: string;
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
  inputUrl: string,
  version: z.infer<typeof confirmationVersionSchema> = 'email-v1',
  installation?: InstallationEmailSection,
): ConfirmationEmail {
  const locale = transactionLocale(order);
  const { t, plan: copy, dir, path, isolate } = transactionCopy(locale);
  const tr = (key: keyof Messages['transactionUi'], params?: Record<string, string | number>) =>
    t(`transactionUi.${key}`, params);
  if (installation && version !== CONFIRMATION_VERSION)
    throw new Error('Installation details require a ready confirmation.');
  const orderUrl = new URL(inputUrl);
  orderUrl.pathname = path(orderUrl.pathname);
  const url = orderUrl.toString();
  const site = orderUrl.origin;
  const business = order.legal.business ?? BUSINESS;
  const reference = orderReference(order.id);
  const money = (cents: number) => confirmationMoney(cents, order.currency);
  const total = money(order.totalCents);
  const labelled = (label: string, value: string) => `${label}: ${value}`;
  const countries = (item: ConfirmationOrder['items'][number]) =>
    item.plan.countries
      .map((code) => `${copy.country(code)} (${isolate(code)})`)
      .join(locale === 'ar' ? '، ' : ', ');
  const d = (label: string, value: string, technical = false) =>
    `<p style="margin:0 0 8px;line-height:1.6"><strong>${e(label)}:</strong> <bdi dir="${technical ? 'ltr' : dir}">${e(value)}</bdi></p>`;
  const itemFields = (item: ConfirmationOrder['items'][number]): [string, string, boolean?][] => [
    [tr('includedCountries'), countries(item)],
    [t('plans.allowance'), copy.allowance(item.plan)],
    [t('plans.validity'), t('plans.days', { count: item.plan.days })],
    [tr('activationRule'), copy.activation(item.plan.activation)],
    [
      tr('restrictions'),
      item.plan.fairUse ? copy.fairUse(item.plan.fairUse) : tr('noRestrictions'),
    ],
    ...(item.plan.supplierNotes
      ? [[tr('supplierConditions'), copy.notes(item.plan.supplierNotes)] satisfies [string, string]]
      : []),
    [tr('unitPrice'), money(item.plan.priceCents), true],
    [tr('lineTotal'), money(item.plan.priceCents * item.quantity), true],
  ];
  const steps = [
    tr('wifiStep'),
    ...(installation ? [t('display.installInstructions')] : [tr('openOrder'), tr('scan')]),
    tr('enable'),
    tr('roaming'),
    tr('connect'),
  ];
  const pending = tr(version === CONFIRMATION_VERSION ? 'ready' : 'pending');
  const tax =
    order.taxCents === undefined
      ? tr('taxNotRecorded')
      : tr('taxPresent', { amount: isolate(money(order.taxCents)) });
  const promotion = order.promotion
    ? [
        labelled(
          tr('originalRetail'),
          isolate(money(order.originalRetailCents ?? order.totalCents)),
        ),
        labelled(
          tr('promotion', {
            code: isolate(order.promotion.code),
            percent: order.promotion.discountPercent,
          }),
          '-' + isolate(money(order.discountCents ?? 0)),
        ),
      ]
    : [];
  const summaryText = order.items
    .map((item) =>
      [
        isolate(String(item.quantity)) + ' × ' + copy.title(item.plan),
        ...itemFields(item).map(([label, value, technical]) =>
          labelled(label, technical ? isolate(value) : value),
        ),
      ].join('\n'),
    )
    .join('\n\n');
  const contractMetadata = [
    labelled(tr('orderReference'), isolate(reference)),
    labelled(tr('contractDate'), isolate(order.createdAt)),
    labelled(tr('paidAt'), isolate(order.paidAt)),
    labelled(t('authUi.email'), isolate(order.email)),
    ...(order.customerName ? [labelled(tr('customerName'), order.customerName)] : []),
    labelled(tr('seller'), isolate(business.company) + ' / ' + isolate(business.brand)),
    labelled(tr('companyNumber'), isolate(business.number)),
    labelled(t('site.office'), isolate(business.address)),
    labelled(tr('contact'), isolate(business.email)),
    labelled(
      tr('purchasedPlans'),
      order.items
        .map(({ plan, quantity }) => `${isolate(String(quantity))} × ${copy.title(plan)}`)
        .join('; '),
    ),
    tr('contractIncludes'),
    ...promotion,
    labelled(tr('totalPaid'), isolate(total)),
    labelled(tr('paymentStatus'), t('status.paid')),
    tax,
    labelled(tr('legalAcceptanceTimestamp'), isolate(order.legal.acceptedAt)),
    labelled(tr('termsVersion'), isolate(order.legal.termsVersion ?? order.legal.version)),
    labelled(tr('refundVersion'), isolate(order.legal.refundVersion ?? order.legal.version)),
    labelled(tr('effectiveDate'), isolate(order.legal.effectiveDate)),
    ...[order.legal.noticeText, order.legal.requestText, order.legal.acknowledgementText].filter(
      (value): value is string => Boolean(value),
    ),
  ];
  const links = [
    [t('legal.terms'), '/terms'],
    [t('legal.privacy'), '/privacy'],
    [t('legal.cookies'), '/cookies'],
    [t('legal.refunds'), '/refund-policy'],
    [t('site.contact'), '/contact'],
  ];
  const footerText = [
    t('seoUi.tagline'),
    business.company,
    labelled(tr('companyNumber'), isolate(business.number)),
    isolate(business.address),
    isolate(business.email),
    ...links.map(([label, href]) => labelled(label, isolate(site + path(href)))),
  ].join('\n');
  const activationLines = order.items.map(
    ({ plan }) =>
      `${copy.title(plan)}: ${copy.activation(plan.activation)} ${t('plans.validity')}: ${t('plans.days', { count: plan.days })}`,
  );
  const text = [
    t('emails.confirmed'),
    tr('thanks'),
    tr('yourOrder'),
    labelled(tr('orderReference'), isolate(reference)),
    labelled(tr('purchaseDate'), isolate(order.paidAt)),
    summaryText,
    ...promotion,
    labelled(tr('totalPaid'), isolate(total)),
    labelled(tr('paymentStatus'), t('status.paid')),
    tax,
    tr('access'),
    tr('viewInstall') + ':\n' + url,
    pending,
    t('installation.title'),
    ...(installation ? [installation.text] : []),
    steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    tr('activationNote'),
    ...activationLines,
    labelled(t('helpUi.title'), site + path('/esim-compatibility')),
    tr('importantTitle'),
    tr('important'),
    tr('purchaseContract'),
    contractMetadata.join('\n'),
    t('legal.terms'),
    order.legal.termsText,
    t('legal.refunds'),
    order.legal.refundText,
    footerText,
  ].join('\n\n');
  const summaryHtml = order.items
    .map(
      (item) =>
        `<div style="padding:14px 0;border-top:1px solid #dddbea"><h3 style="font-size:17px;margin:0 0 12px"><bdi dir="ltr">${item.quantity}</bdi> × ${e(copy.title(item.plan))}</h3>${itemFields(
          item,
        )
          .map(([label, value, technical]) => d(label, value, technical))
          .join('')}</div>`,
    )
    .join('');
  const contractHtml = `<section aria-label="${e(tr('purchaseContract'))}" style="border-top:1px solid #dddbea;margin-top:32px;padding-top:8px">${heading(tr('purchaseContract'))}<div style="font-size:14px;line-height:1.7;color:#41495e">${contractMetadata.map((line) => `<p style="margin:0 0 8px">${e(line)}</p>`).join('')}${heading(t('legal.terms'))}${legalEmailHtml(order.legal.termsText)}${heading(t('legal.refunds'))}${legalEmailHtml(order.legal.refundText)}</div></section>`;
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${e(t('emails.confirmationSubject'))}</title></head><body style="margin:0;background:#f6f6fb;font-family:Inter,Arial,sans-serif;color:#1b2035"><table role="presentation" dir="ltr" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border:1px solid #e2e3ed;border-radius:16px"><tr><td dir="${dir}" style="padding:28px 24px;overflow-wrap:anywhere;word-break:break-word"><img src="${e(site)}/images/alozuri-email-logo.png" width="132" height="40" alt="Alozuri" style="display:block;border:0;object-fit:contain;object-position:center;padding:10px 16px;border-radius:12px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);box-sizing:content-box;margin-left:0;margin-right:auto"><h1 style="font-size:26px;line-height:1.25;margin:24px 0 12px">${e(t('emails.confirmed'))}</h1>${paragraph(tr('thanks'))}${heading(tr('yourOrder'))}<div style="background:#f5f4ff;border-radius:10px;padding:16px;font-size:15px;line-height:1.65">${d(tr('orderReference'), reference, true)}${d(tr('purchaseDate'), order.paidAt, true)}${summaryHtml}${promotion.map((line) => paragraph(line)).join('')}${d(tr('totalPaid'), total, true)}${d(tr('paymentStatus'), t('status.paid'))}<p style="font-size:14px;margin:0">${e(tax)}</p></div>${heading(tr('access'))}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#4b3dcc" style="border-radius:10px"><a href="${e(url)}" style="display:block;padding:16px 12px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;line-height:1.5">${e(tr('viewInstall'))}</a></td></tr></table><div style="margin-top:16px">${paragraph(pending)}</div>${heading(tr('installReady'))}${installation?.html ?? ''}<ol style="padding-${dir === 'rtl' ? 'right' : 'left'}:22px;font-size:16px;line-height:1.65;margin:0 0 16px">${steps.map((step) => `<li style="margin-bottom:8px">${e(step)}</li>`).join('')}</ol>${paragraph(tr('activationNote'))}${activationLines.map(paragraph).join('')}<p style="font-size:16px;line-height:1.65"><a href="${e(site + path('/esim-compatibility'))}" style="color:#4b3dcc">${e(t('helpUi.title'))}</a></p>${heading(tr('importantTitle'))}${paragraph(tr('important'))}${contractHtml}<div style="border-top:1px solid #dddbea;margin-top:28px;padding-top:20px;font-size:14px;line-height:1.8;color:#656d83"><strong>${e(t('seoUi.tagline'))}</strong><br><bdi dir="ltr">${e(business.company)}</bdi><br>${e(tr('companyNumber'))} <bdi dir="ltr">${e(business.number)}</bdi><br><bdi dir="ltr">${e(business.address)}</bdi><br><a href="mailto:${e(business.email)}" dir="ltr" style="color:#4b3dcc">${e(business.email)}</a><p style="margin-top:14px">${links.map(([label, href]) => `<a href="${e(site + path(href))}" style="display:inline-block;padding:6px 8px 6px 0;color:#4b3dcc">${e(label)}</a>`).join(' ')}</p></div></td></tr></table></td></tr></table></body></html>`;
  return {
    id: order.id,
    version,
    email: order.email,
    url,
    text,
    html,
    subject: t('emails.confirmationSubject'),
    ...(installation ? { attachments: installation.attachments } : {}),
  };
}
export function confirmationPayload(input: ConfirmationEmail) {
  return {
    from: input.from ?? ORDER_EMAIL_FROM,
    to: [input.email],
    reply_to: input.replyTo ?? 'support@alozuri.com',
    subject: input.subject ?? englishMessages.emails.confirmationSubject,
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
