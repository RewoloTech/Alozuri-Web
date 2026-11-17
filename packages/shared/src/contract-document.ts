import { orderLocale, requirePublishedLocale, LocaleUnavailableError } from './i18n/locales.ts';
import { transactionCopy } from './i18n/transaction-copy.ts';
import type { Messages } from './i18n/messages.ts';
import type PDFDocument from 'pdfkit';
import { BUSINESS } from './legal.ts';
import { drawArabicPdfText } from './pdf-text.ts';
import {
  validateContractOrder,
  contractMoney as confirmationMoney,
  orderReference,
  type ContractOrder,
} from './contract.ts';
const navy = '#1b2035',
  purple = '#4b3dcc',
  muted = '#656d83';
// One document layout for the authorised browser download and optional API endpoint.
export function drawContractPdf(doc: InstanceType<typeof PDFDocument>, order: ContractOrder): void {
  validateContractOrder(order);
  const locale = requirePublishedLocale(orderLocale(order.locale));
  if (orderLocale(order.legal.locale) !== locale) throw new LocaleUnavailableError();
  const { t, plan: copy, isolate } = transactionCopy(locale);
  const tr = (key: keyof Messages['transactionUi']) => t(`transactionUi.${key}`);
  const business = order.legal.business ?? BUSINESS;
  const width = doc.page.width - 88;
  const room = (height = 48) => {
    if (doc.y + height > doc.page.height - 54) doc.addPage();
  };
  const paragraph = (text: string) => {
    if (locale === 'ar') {
      drawArabicPdfText(doc, text, { width, size: 10, color: navy });
      return;
    }
    doc
      .font('Inter')
      .fontSize(10)
      .fillColor(navy)
      .text(text, { width, lineGap: 3, paragraphGap: 7 });
  };
  const heading = (text: string) => {
    room(62);
    if (locale === 'ar') {
      doc.y += 8;
      drawArabicPdfText(doc, text, { width, size: 14, bold: true, color: purple, gap: 6 });
      return;
    }
    doc.moveDown(0.6).font('InterBold').fontSize(14).fillColor(purple).text(text, { width });
    doc.moveDown(0.4);
  };
  const row = (label: string, value: string, technical = false) => {
    room(32);
    if (locale === 'ar') {
      drawArabicPdfText(doc, `${label}: ${technical ? isolate(value) : value}`, {
        width,
        size: 10,
        color: navy,
        gap: 6,
      });
      return;
    }
    doc
      .font('InterBold')
      .fontSize(10)
      .fillColor(navy)
      .text(`${label}: `, { width, continued: true });
    doc.font('Inter').text(value, { width, lineGap: 3, paragraphGap: 6 });
  };
  const legal = (text: string) => {
    // Render the immutable order snapshot, never today's translated policy.
    for (const block of text.split(/\n\n/)) {
      const [first, ...rest] = block.split('\n');
      if (first && /^\d+\.\s/.test(first)) {
        heading(first);
        if (rest.length) paragraph(rest.join('\n'));
      } else paragraph(block);
    }
  };
  if (locale === 'ar')
    drawArabicPdfText(doc, tr('title'), { width, size: 22, bold: true, color: navy, gap: 8 });
  else {
    doc.font('InterBold').fontSize(22).fillColor(navy).text(tr('title'), { width });
    doc.moveDown(0.5);
  }
  paragraph(business.identity);
  paragraph(
    `${t('site.office')}: ${isolate(business.address)}\n${tr('contact')}: ${isolate(business.email)}`,
  );
  heading(tr('confirmedPurchase'));
  row(tr('orderReference'), orderReference(order.id), true);
  row(tr('orderPlaced'), order.createdAt, true);
  row(tr('paidAt'), order.paidAt ?? tr('timestampMissing'), Boolean(order.paidAt));
  row(
    tr('paymentStatus'),
    order.test
      ? tr('testPayment')
      : order.status === 'refunded'
        ? t('status.refunded')
        : t('status.paid'),
  );
  if (order.customerName) row(tr('customerName'), order.customerName);
  row(t('authUi.email'), order.email, true);
  heading(tr('purchasedPlans'));
  for (const { plan, quantity } of order.items) {
    room(64);
    if (locale === 'ar')
      drawArabicPdfText(doc, `${isolate(String(quantity))} × ${copy.title(plan)}`, {
        width,
        size: 12,
        bold: true,
        color: navy,
        gap: 7,
      });
    else {
      doc
        .font('InterBold')
        .fontSize(12)
        .fillColor(navy)
        .text(`${quantity} × ${copy.title(plan)}`, { width });
      doc.moveDown(0.5);
    }
    row(tr('planReference'), plan.id, true);
    row(
      tr('includedCountries'),
      plan.countries
        .map((code) => `${copy.country(code)} ${isolate('(' + code + ')')}`)
        .join(locale === 'ar' ? '، ' : ', '),
    );
    row(t('plans.allowance'), copy.allowance(plan));
    row(t('plans.validity'), t('plans.days', { count: plan.days }));
    row(tr('activationRule'), copy.activation(plan.activation));
    row(tr('restrictions'), plan.fairUse ? copy.fairUse(plan.fairUse) : tr('noRestrictions'));
    if (plan.supplierNotes) row(tr('supplierConditions'), copy.notes(plan.supplierNotes));
    row(tr('quantity'), String(quantity), true);
    row(tr('unitPrice'), confirmationMoney(plan.priceCents, order.currency), true);
    row(tr('lineTotal'), confirmationMoney(plan.priceCents * quantity, order.currency), true);
    doc.moveDown(0.7);
  }
  heading(tr('paymentTotal'));
  if (order.subtotalCents !== undefined)
    row(t('cart.subtotal'), confirmationMoney(order.subtotalCents, order.currency), true);
  row(
    tr('tax'),
    order.taxCents === undefined
      ? tr('taxMissing')
      : confirmationMoney(order.taxCents, order.currency),
    order.taxCents !== undefined,
  );
  row(tr('totalPaid'), confirmationMoney(order.totalCents, order.currency), true);
  paragraph(tr('taxDoc'));
  heading(tr('legalAcceptance'));
  row(tr('acceptedAt'), order.legal.acceptedAt, true);
  row(tr('termsVersion'), order.legal.termsVersion ?? order.legal.version, true);
  row(tr('refundVersion'), order.legal.refundVersion ?? order.legal.version, true);
  row(tr('effectiveDate'), order.legal.effectiveDate, true);
  for (const text of [
    order.legal.noticeText,
    order.legal.requestText,
    order.legal.acknowledgementText,
  ])
    if (text) paragraph(text);
  heading(t('legal.terms'));
  legal(order.legal.termsText);
  heading(t('legal.refunds'));
  legal(order.legal.refundText);
  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index);
    doc.save().roundedRect(44, 26, 28, 28, 8).fill(purple);
    doc.strokeColor('#ffffff').lineWidth(1.2).circle(58, 40, 9).stroke();
    doc.ellipse(58, 40, 4, 9).stroke().moveTo(49, 40).lineTo(67, 40).stroke();
    doc.moveTo(51, 35).lineTo(65, 35).stroke().moveTo(51, 45).lineTo(65, 45).stroke().restore();
    doc.font('LatinBold').fontSize(21).fillColor(navy).text('alo', 80, 27, { continued: true });
    doc.fillColor(purple).text('zuri', { lineBreak: false });
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Latin')
      .fontSize(7)
      .fillColor(muted)
      .text(
        `${orderReference(order.id)}  ·  ${index + 1} / ${pages.count}`,
        44,
        doc.page.height - 30,
        { width, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottom;
  }
}
