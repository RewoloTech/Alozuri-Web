import { documentFontFiles } from '@alozuri/shared/document-fonts';
import { orderLocale, requirePublishedLocale } from '@alozuri/shared/i18n';
import { transactionCopy } from '@alozuri/shared/i18n/transaction-copy';
import { ContractDownloadError } from './contract-errors';
import PDFDocument from 'pdfkit';
import { drawContractPdf } from '@alozuri/shared/contract-document';
import { validateContractOrder, type ContractOrder } from '@alozuri/shared/contract';
const fonts = new Map<string, Promise<Uint8Array>>();
async function fontBytes(file: string) {
  const path =
    file === 'Inter-400.ttf'
      ? '/fonts/inter-pdf-400.ttf'
      : file === 'Inter-700.ttf'
        ? '/fonts/inter-pdf-700.ttf'
        : '/fonts/' + file;
  let pending = fonts.get(file);
  if (!pending) {
    pending = fetch(path, { cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) throw new ContractDownloadError('FONT_UNAVAILABLE');
        return new Uint8Array(await response.arrayBuffer());
      })
      .catch(() => {
        fonts.delete(file);
        throw new ContractDownloadError('FONT_UNAVAILABLE');
      });
    fonts.set(file, pending);
  }
  return pending;
}
// Loaded only after a customer clicks Download on an already authorised order.
// No PDF endpoint, supplier request, upload or permanent PDF storage is involved.
export async function createContractPdf(order: ContractOrder): Promise<Blob> {
  validateContractOrder(order);
  const locale = requirePublishedLocale(orderLocale(order.locale));
  const { t } = transactionCopy(locale);
  const font = await Promise.all(
    Object.entries(documentFontFiles(locale)).map(async ([name, file]) => ({
      name,
      bytes: await fontBytes(file),
    })),
  );
  const doc = new PDFDocument({
    font: '',
    size: 'A4',
    lang: locale === 'en' ? 'en-GB' : locale,
    margins: { top: 80, right: 44, bottom: 54, left: 44 },
    bufferPages: true,
    autoFirstPage: false,
    compress: true,
    info: {
      Title: t('transactionUi.title'),
      Author: order.legal.business?.company ?? 'Rewolo Technologies Ltd',
      CreationDate: new Date(order.paidAt ?? order.createdAt),
      ModDate: new Date(order.paidAt ?? order.createdAt),
    },
  });
  const output = new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    doc.on('data', (chunk: Uint8Array) => {
      size += chunk.byteLength;
      if (size > 5 * 1024 * 1024) doc.destroy(new Error('Contract exceeds the download limit.'));
      else chunks.push(new Uint8Array(chunk));
    });
    doc.on('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })));
    doc.on('error', reject);
  });
  try {
    for (const entry of font) doc.registerFont(entry.name, entry.bytes);
    doc.font('Inter');
    doc.addPage();
    drawContractPdf(doc, order);
    doc.end();
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error('Your contract could not be prepared.'));
  }
  return output;
}
