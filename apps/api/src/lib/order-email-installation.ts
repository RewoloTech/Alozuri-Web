import QRCode from 'qrcode';
import { z } from 'zod';
import { activationSchema } from './supplier.js';
import {
  CONFIRMATION_VERSION,
  confirmationOrderSchema,
  type ConfirmationOrder,
} from './confirmation-order.js';
import { confirmationEmail, escapeEmailHtml, type InlineEmailImage } from './order-email.js';

// Internal input only: populated from the purchase's owned, private activation records.
export const emailInstallationSchema = z.object({
  unitId: z.string().regex(/^order_[a-f0-9]{48}$/),
  planId: z.string().min(1).max(100),
  activation: activationSchema,
});
export type EmailInstallation = z.infer<typeof emailInstallationSchema>;
const e = escapeEmailHtml;
const instructions =
  'Connect to Wi-Fi before installing. Follow your plan’s activation rule and keep these details private.';
const keepProfile =
  'Do not delete the eSIM after installing unless support asks you to. Some profiles can only be installed once.';

export async function installationConfirmationEmail(
  input: ConfirmationOrder,
  url: string,
  inputUnits: EmailInstallation[],
) {
  const order = confirmationOrderSchema.parse(input);
  const units = z
    .array(emailInstallationSchema)
    .min(1)
    .max(10)
    .parse(inputUnits)
    .sort((a, b) => a.unitId.localeCompare(b.unitId, 'en'));
  const expected = new Map<string, number>();
  for (const item of order.items)
    expected.set(item.plan.id, (expected.get(item.plan.id) ?? 0) + item.quantity);
  const seen = new Set<string>();
  for (const unit of units) {
    const remaining = expected.get(unit.planId);
    if (seen.has(unit.unitId) || !remaining)
      throw new Error('Installation details do not match the purchased units.');
    seen.add(unit.unitId);
    expected.set(unit.planId, remaining - 1);
  }
  if ([...expected.values()].some((remaining) => remaining !== 0))
    throw new Error('Installation details are incomplete.');

  const attachments: InlineEmailImage[] = [];
  const html: string[] = [];
  const text: string[] = [instructions];
  for (const [index, unit] of units.entries()) {
    const item = order.items.find((item) => item.plan.id === unit.planId);
    if (!item) throw new Error('Installation plan is unavailable.');
    const { plan } = item;
    const title = `eSIM ${index + 1} — ${plan.name}`;
    const [, address, code, confirmation] = unit.activation.ac.split('$');
    const fields = [
      ['SM-DP+ address', address],
      ['Activation code', code],
      ...(confirmation ? [['Confirmation code', confirmation]] : []),
      ['ICCID', unit.activation.iccid],
    ];
    const contentId = `alozuri-esim-${index + 1}`;
    // No external QR URL or public storage: the PNG travels only inside this email.
    const png = await QRCode.toBuffer(unit.activation.ac, {
      type: 'png',
      width: 480,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    });
    attachments.push({
      filename: `${contentId}.png`,
      content: png.toString('base64'),
      content_type: 'image/png',
      content_id: contentId,
    });
    html.push(
      `<div role="group" aria-label="Installation details for eSIM ${index + 1}" style="margin:16px 0 24px;padding:14px;border:1px solid #e2e3ed;border-radius:10px;background:#ffffff"><h3 style="font-size:17px;line-height:1.5;margin:0 0 12px">${e(title)}</h3><img src="cid:${contentId}" alt="Private installation QR code for eSIM ${index + 1}" width="240" height="240" style="display:block;width:240px;max-width:100%;height:auto;margin:12px auto;background:#ffffff">${fields.map(([label, value]) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word"><strong>${e(label)}:</strong><br>${e(value)}</p>`).join('')}</div>`,
    );
    text.push(title, ...fields.map(([label, value]) => `${label}: ${value}`));
  }
  return confirmationEmail(order, url, CONFIRMATION_VERSION, {
    html: `<p style="font-size:16px;line-height:1.65;margin:0 0 14px">${e(instructions)}</p>${html.join('')}<p style="font-size:16px;line-height:1.65;margin:0 0 14px">${e(keepProfile)}</p>`,
    text: [...text, keepProfile].join('\n\n'),
    attachments,
  });
}
