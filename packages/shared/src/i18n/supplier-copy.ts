import type { Messages } from './messages.ts';
export type SupplierCopyKey = keyof Messages['supplierCopy'];
export type SupplierCopyMessage = {
  key: SupplierCopyKey;
  params: Record<string, string | number>;
};
const paragraphs: Record<string, SupplierCopyKey> = {
  'Supplier describes this plan as unlimited. Check plan name and supplier conditions for speed restrictions.':
    'unlimited',
  'SM-DP+ Status: Online SM-DP+ status inquiry is not supported.': 'statusUnavailable',
  'Check Usage: Online usage inquiry is not supported.': 'usageUnavailable',
  'Check Usage: Online usage inquiry is not supported. Please contact online customer support for usage information.':
    'usageContact',
  'Validity: Valid for 15 days from first use. The validity period starts when you arrive at your destination and start using mobile data. The system’s “Activate Time” does not indicate the actual first-use time.':
    'validity15',
  'Refund Policy: Once purchased, the eSIM status changes to IN USE. Refunds are not available, including for unused eSIMs.':
    'refundInUse',
  'Refund Policy: Once purchased, refunds are not supported.': 'refundPurchase',
  'Check Usage: Usage Check API is not yet supported. Please click the refresh button on console portal to check real-time remaining data for reference.':
    'usageConsole',
};
const size = '(\\d+(?:\\.\\d+)? (?:GB|MB))';
const reduced = new RegExp(
  '^' + size + ' high-speed per day, then reduced speed \\((\\d+(?:\\.\\d+)?\\s*[KMG]bps)\\)\\.$',
);
const reducedPolicy = new RegExp(
  '^' +
    size +
    ' high-speed per day, then reduced speed according to the supplier fair-use policy\\.$',
);
const cutoff = new RegExp(
  '^' +
    size +
    ' per day\\. Service stops at the daily limit\\.\\s*(\\d+(?:\\.\\d+)?\\s*[KMG]bps)?$',
);
const minimum =
  /^Sales Policy: Resellers must ensure that the retail price to end customers is no less than USD (\d+(?:\.\d+)?), in compliance with this minimum retail price policy by carrier supplier, otherwise the plan reselling may be stopped\.$/;

/** Recognises only exact source templates. This never infers supplier terms. */
export function supplierCopyMessage(source: string): SupplierCopyMessage | null {
  const text = source.trim();
  if (Object.hasOwn(paragraphs, text)) return { key: paragraphs[text], params: {} };
  const dailyReduced = reduced.exec(text);
  if (dailyReduced)
    return { key: 'reduced', params: { size: dailyReduced[1], speed: dailyReduced[2] } };
  const fairUseReduced = reducedPolicy.exec(text);
  if (fairUseReduced) return { key: 'reducedPolicy', params: { size: fairUseReduced[1] } };
  const dailyCutoff = cutoff.exec(text);
  if (dailyCutoff)
    return { key: 'cutoff', params: { size: dailyCutoff[1], policy: dailyCutoff[2] ?? '' } };
  const salesMinimum = minimum.exec(text);
  if (salesMinimum) return { key: 'salesMinimum', params: { amount: salesMinimum[1] } };
  return null;
}
export function translateSupplierCopy(
  source: string,
  translate: (key: SupplierCopyKey, params: Record<string, string | number>) => string,
  isolate: (value: string) => string = (value) => value,
): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      const message = supplierCopyMessage(line);
      if (!message) return line;
      const params = Object.fromEntries(
        Object.entries(message.params).map(([key, value]) => [
          key,
          typeof value === 'string' ? isolate(value) : value,
        ]),
      );
      return translate(message.key, params);
    })
    .join('\n');
}
