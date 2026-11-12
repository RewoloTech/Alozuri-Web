import PDFDocument from 'pdfkit';
import { drawContractPdf } from '@alozuri/shared/contract-document';
import { validateContractOrder, type ContractOrder } from '@alozuri/shared/contract';
let fonts: Promise<{ regular: Uint8Array; bold: Uint8Array }> | undefined;
async function fontBytes() {
  fonts ??= Promise.all(
    [400, 700].map(async (weight) => {
      const response = await fetch(`/fonts/inter-pdf-${weight}.ttf`, { cache: 'force-cache' });
      if (!response.ok) throw new Error('The PDF font could not be loaded. Please retry.');
      return new Uint8Array(await response.arrayBuffer());
    }),
  )
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error: unknown) => {
      fonts = undefined;
      throw error;
    });
  return fonts;
}
// Loaded only after a customer clicks Download on an already authorised order.
// No PDF endpoint, supplier request, upload or permanent PDF storage is involved.
export async function createContractPdf(order: ContractOrder): Promise<Blob> {
  validateContractOrder(order);
  const font = await fontBytes();
  const doc = new PDFDocument({
    font: '',
    size: 'A4',
    margins: { top: 80, right: 44, bottom: 54, left: 44 },
    bufferPages: true,
    autoFirstPage: false,
    compress: true,
    info: {
      Title: 'Alozuri — Order Confirmation & Contract',
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
    doc.registerFont('Inter', font.regular).registerFont('InterBold', font.bold).font('Inter');
    doc.addPage();
    drawContractPdf(doc, order);
    doc.end();
  } catch (error) {
    doc.destroy(error instanceof Error ? error : new Error('Your contract could not be prepared.'));
  }
  return output;
}
