import type PDFDocument from 'pdfkit';
import { BUSINESS } from './legal.ts';
import { countryName, dataLabel } from './index.ts';
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
  const business = order.legal.business ?? BUSINESS;
  const width = doc.page.width - 88;
  const room = (height = 48) => {
    if (doc.y + height > doc.page.height - 54) doc.addPage();
  };
  const paragraph = (text: string) => {
    doc
      .font('Inter')
      .fontSize(10)
      .fillColor(navy)
      .text(text, { width, lineGap: 3, paragraphGap: 7 });
  };
  const heading = (text: string) => {
    room(62);
    doc.moveDown(0.6).font('InterBold').fontSize(14).fillColor(purple).text(text, { width });
    doc.moveDown(0.4);
  };
  const row = (label: string, value: string) => {
    room(32);
    doc
      .font('InterBold')
      .fontSize(10)
      .fillColor(navy)
      .text(`${label}: `, { width, continued: true });
    doc.font('Inter').text(value, { width, lineGap: 3, paragraphGap: 6 });
  };
  const legal = (text: string) => {
    for (const block of text.split(/\n\n/)) {
      const [first, ...rest] = block.split('\n');
      if (first && /^\d+\.\s/.test(first)) {
        heading(first);
        if (rest.length) paragraph(rest.join('\n'));
      } else paragraph(block);
    }
  };
  doc
    .font('InterBold')
    .fontSize(22)
    .fillColor(navy)
    .text('Alozuri — Order Confirmation & Contract', { width });
  doc.moveDown(0.5);
  paragraph(business.identity);
  paragraph(`Registered office: ${business.address}\nContact: ${business.email}`);
  heading('Your confirmed purchase');
  row('Order reference', orderReference(order.id));
  row('Order placed', order.createdAt);
  row('Payment confirmed at', order.paidAt ?? 'Timestamp not included in this order response');
  row(
    'Payment status',
    order.test
      ? 'Successful test payment — no real charge or eSIM'
      : order.status === 'refunded'
        ? 'Refunded'
        : 'Paid',
  );
  if (order.customerName) row('Customer name', order.customerName);
  row('Customer email', order.email);
  heading('Purchased plans');
  for (const { plan, quantity } of order.items) {
    room(64);
    doc
      .font('InterBold')
      .fontSize(12)
      .fillColor(navy)
      .text(`${quantity} × ${plan.name}`, { width });
    doc.moveDown(0.5);
    row('Plan reference', plan.id);
    row(
      'Included countries',
      plan.countries.map((code) => `${countryName(code)} (${code})`).join(', '),
    );
    row('Data allowance', dataLabel(plan));
    row('Validity', `${plan.days} days`);
    row('Activation rule', plan.activation);
    row('Restrictions / fair use', plan.fairUse || 'No additional restriction recorded.');
    if (plan.supplierNotes) row('Supplier conditions', plan.supplierNotes);
    row('Quantity', String(quantity));
    row('Unit price', confirmationMoney(plan.priceCents, order.currency));
    row('Line total', confirmationMoney(plan.priceCents * quantity, order.currency));
    doc.moveDown(0.7);
  }
  heading('Payment total');
  if (order.subtotalCents !== undefined)
    row('Subtotal', confirmationMoney(order.subtotalCents, order.currency));
  row(
    'Separately charged tax',
    order.taxCents === undefined
      ? 'Not recorded separately'
      : confirmationMoney(order.taxCents, order.currency),
  );
  row('Total paid', confirmationMoney(order.totalCents, order.currency));
  paragraph(
    'No tax rate or VAT registration is recorded on this order. This is an order confirmation and contract.',
  );
  heading('Recorded legal acceptance');
  row('Accepted at', order.legal.acceptedAt);
  row('Terms and Conditions version', order.legal.termsVersion ?? order.legal.version);
  row('Refund and Cancellation Policy version', order.legal.refundVersion ?? order.legal.version);
  row('Policy effective date', order.legal.effectiveDate);
  for (const text of [
    order.legal.noticeText,
    order.legal.requestText,
    order.legal.acknowledgementText,
  ])
    if (text) paragraph(text);
  heading('Terms and Conditions');
  legal(order.legal.termsText);
  heading('Refund and Cancellation Policy');
  legal(order.legal.refundText);
  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index);
    doc.save().roundedRect(44, 26, 28, 28, 8).fill(purple);
    doc.strokeColor('#ffffff').lineWidth(1.2).circle(58, 40, 9).stroke();
    doc.ellipse(58, 40, 4, 9).stroke().moveTo(49, 40).lineTo(67, 40).stroke();
    doc.moveTo(51, 35).lineTo(65, 35).stroke().moveTo(51, 45).lineTo(65, 45).stroke().restore();
    doc.font('InterBold').fontSize(21).fillColor(navy).text('alo', 80, 27, { continued: true });
    doc.fillColor(purple).text('zuri', { lineBreak: false });
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Inter')
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
