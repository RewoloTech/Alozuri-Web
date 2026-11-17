import { documentFontFiles } from '../../../../packages/shared/src/document-fonts.ts';
import { transactionCopy } from '../../../../packages/shared/src/i18n/transaction-copy.ts';
import { transactionLocale } from './transaction-locale.js';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { confirmationOrderSchema, type ConfirmationOrder } from './confirmation-order.js';

const asset = (name: string) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));
import { drawContractPdf } from '../../../../packages/shared/src/contract-document.ts';
// Called only by the authorised download endpoint. No files, database records,
// Storage objects or email attachments are created by this renderer.
export async function renderContractPdf(input: ConfirmationOrder): Promise<Buffer> {
  const order = confirmationOrderSchema.parse(input);
  const locale = transactionLocale(order);
  const { t } = transactionCopy(locale);
  const doc = new PDFDocument({
    size: 'A4',
    lang: locale === 'en' ? 'en-GB' : locale,
    margins: { top: 80, right: 44, bottom: 54, left: 44 },
    bufferPages: true,
    autoFirstPage: false,
    compress: true,
    info: {
      Title: t('transactionUi.title'),
      Author: order.legal.business?.company ?? 'Rewolo Technologies Ltd',
      Subject: t('transactionUi.orderReference') + ': ' + order.id,
      CreationDate: new Date(order.paidAt),
      ModDate: new Date(order.paidAt),
    },
  });
  const output = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    doc.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) doc.destroy(new Error('Contract exceeds the download limit.'));
      else chunks.push(chunk);
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  for (const [name, file] of Object.entries(documentFontFiles(locale)))
    doc.registerFont(name, asset('fonts/' + file));
  doc.addPage();
  try {
    drawContractPdf(doc, order);
    doc.end();
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error('Contract could not be rendered.'));
  }
  return output;
}
