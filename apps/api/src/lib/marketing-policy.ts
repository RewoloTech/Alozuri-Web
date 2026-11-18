import { isCountryCode } from '../../../../packages/shared/src/index.ts';
import { z } from 'zod';
import { LOCALES } from '../../../../packages/shared/src/i18n/locales.ts';
export const marketingId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const marketingUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!(value.startsWith('/') || value.startsWith('https://')) || /[\\\u0000-\u0020]/.test(value))
      return false;
    try {
      const url = new URL(value, 'https://alozuri.com');
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        (!value.startsWith('/') || !value.startsWith('//'))
      );
    } catch {
      return false;
    }
  }, 'Use an internal path or an HTTPS URL.');
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const marketingText = z
  .object({
    heading: z.string().max(160).default(''),
    description: z.string().max(500).default(''),
    ctaLabel: z.string().max(80).default(''),
    dismissLabel: z.string().max(80).default(''),
  })
  .strict();
export const translationsSchema = z
  .partialRecord(z.enum(LOCALES), marketingText)
  .refine(
    (v) => !!v.en && !!(v.en.heading || v.en.description),
    'Provide English fallback content.',
  );
const schedule = { active: z.boolean(), startsAt: z.iso.datetime(), expiresAt: z.iso.datetime() };
export const campaignSchema = z
  .object({ id: marketingId, name: z.string().trim().min(1).max(120), ...schedule })
  .strict()
  .refine((v) => v.startsAt < v.expiresAt, 'Expiry must follow start.');
export const bannerSchema = z
  .object({
    id: marketingId,
    name: z.string().trim().min(1).max(120),
    ...schedule,
    placement: z.enum(['announcement', 'homepage', 'destination', 'region']),
    targets: z.array(z.string().max(100)).max(250).default([]),
    homepageOnly: z.boolean().default(false),
    desktop: z.boolean().default(true),
    mobile: z.boolean().default(true),
    priority: z.number().int().min(0).max(10000).default(0),
    dismissible: z.boolean().default(false),
    background: color.default('#4338CA'),
    foreground: color.default('#FFFFFF'),
    campaignId: marketingId.optional(),
    promotionId: marketingId.optional(),
    translations: translationsSchema,
    ctaUrl: marketingUrl.optional(),
    desktopImage: marketingUrl.optional(),
    mobileImage: marketingUrl.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.startsAt >= v.expiresAt)
      ctx.addIssue({ code: 'custom', message: 'Expiry must follow start.' });
    if ((v.placement === 'destination' || v.placement === 'region') && !v.targets.length)
      ctx.addIssue({ code: 'custom', message: 'Select target pages.' });
    if (v.placement === 'destination' && v.targets.some((t) => !isCountryCode(t.toUpperCase())))
      ctx.addIssue({ code: 'custom', message: 'Select valid destination codes.' });
    if (v.placement === 'region' && v.targets.some((t) => t !== 'europe'))
      ctx.addIssue({ code: 'custom', message: 'Europe is the currently published regional page.' });
    if (Object.values(v.translations).some((t) => t?.ctaLabel) && !v.ctaUrl)
      ctx.addIssue({ code: 'custom', message: 'CTA requires a URL.' });
    if (v.dismissible && Object.values(v.translations).some((t) => t && !t.dismissLabel))
      ctx.addIssue({
        code: 'custom',
        message: 'Dismissible banners need a translated dismiss label.',
      });
    if (contrast(v.background, v.foreground) < 4.5)
      ctx.addIssue({ code: 'custom', message: 'Text contrast must be at least 4.5:1.' });
  });
export type WebsiteBanner = z.infer<typeof bannerSchema>;
export function activeWindow(
  v: { active: boolean; startsAt: string; expiresAt: string },
  now = Date.now(),
) {
  return (
    v.active &&
    Number.isFinite(Date.parse(v.startsAt)) &&
    Number.isFinite(Date.parse(v.expiresAt)) &&
    Date.parse(v.startsAt) <= now &&
    now < Date.parse(v.expiresAt)
  );
}
export function campaignStatus(
  v: { active: boolean; startsAt: string; expiresAt: string },
  now = Date.now(),
) {
  return !v.active
    ? 'paused'
    : Date.parse(v.expiresAt) <= now
      ? 'expired'
      : Date.parse(v.startsAt) > now
        ? 'scheduled'
        : 'active';
}
export function contrast(a: string, b: string) {
  const luminance = (hex: string) =>
    [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
