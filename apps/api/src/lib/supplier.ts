import { createHmac, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { dataSizeLabel, type StoredPlan } from '../../../../packages/shared/src/index.ts';
import { pricePackage } from './package-pricing.js';
import { moneyInteger } from './pricing.js';
import { storedPlanSchema } from './validation.js';
const sourcePackage = z.object({
  packageCode: z.string().min(1).max(200),
  name: z.string().min(1).max(1000),
  price: z.unknown().optional(),
  currencyCode: z.unknown().optional(),
  volume: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER),
  duration: z.number().int().positive().max(3660),
  durationUnit: z.literal('DAY'),
  durationType: z.literal(1),
  dataType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  saleNote: z.string().max(10000).nullish(),
  location: z.string().min(2),
  activeType: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  fupPolicy: z.string().nullish(),
  locationNetworkList: z
    .array(
      z.object({
        operatorList: z.array(
          z.object({ operatorName: z.string(), networkType: z.string().optional() }),
        ),
      }),
    )
    .optional(),
});
export function catalogueId(code: string) {
  return 'esim-' + createHash('sha256').update(code).digest('hex').slice(0, 24);
}
export function adaptPackage(input: unknown, syncedAt: string): StoredPlan | null {
  const parsed = sourcePackage.safeParse(input);
  if (!parsed.success) return null;
  const p = parsed.data,
    countries = [...new Set(p.location.split(',').map((c) => c.trim().toUpperCase()))];
  if (!countries.length || countries.some((c) => !/^([A-Z]{2})$/.test(c))) return null;
  const networks = [
    ...new Set(
      (p.locationNetworkList || []).flatMap((l) =>
        l.operatorList.map((o) => o.operatorName + (o.networkType ? ' ' + o.networkType : '')),
      ),
    ),
  ];
  const publicFields = {
    id: catalogueId(p.packageCode),
    name: p.name,
    countries,
    dataGb: p.volume / 1073741824,
    days: p.duration,
    priceCents: 0,
    currency: 'USD' as const,
    dataType: (p.dataType === 4 || (p.dataType === 1 && /\bunlimited\b/i.test(p.name))
      ? 'unlimited'
      : p.dataType === 1
        ? 'fixed'
        : 'daily') as StoredPlan['dataType'],
    ...(p.dataType === 2
      ? { dailyPolicy: 'reduced' as const }
      : p.dataType === 3
        ? { dailyPolicy: 'cutoff' as const }
        : {}),
    ...(p.saleNote ? { supplierNotes: p.saleNote } : {}),
    activation:
      p.activeType === 2
        ? 'Starts on first connection to a supported mobile network.'
        : p.activeType === 3
          ? 'Validity starts after purchase. Buy only when you are ready to use it.'
          : 'Validity starts when the eSIM is installed. Install when you are ready to use it.',
    networks: networks.slice(0, 250),
    fairUse:
      p.dataType === 2
        ? `${dataSizeLabel(p.volume / 1073741824)} high-speed per day, then reduced speed${p.fupPolicy ? ' (' + p.fupPolicy + ')' : ' according to the supplier fair-use policy'}.`
        : p.dataType === 3
          ? `${dataSizeLabel(p.volume / 1073741824)} per day. Service stops at the daily limit. ${p.fupPolicy || ''}`
          : p.fupPolicy ||
            (p.dataType === 4 || /\bunlimited\b/i.test(p.name)
              ? 'Supplier describes this plan as unlimited. Check plan name and supplier conditions for speed restrictions.'
              : 'Fixed total data allowance. Data only; no local phone number.'),
    syncedAt,
    active: p.currencyCode === 'USD' && moneyInteger(p.price),
  };
  if (!storedPlanSchema.safeParse(publicFields).success) return null;
  return pricePackage({
    ...publicFields,
    providerId: 'esim-access',
    supplierCode: p.packageCode,
    wholesaleUnits: p.currencyCode === 'USD' && moneyInteger(p.price) ? p.price : 0,
  });
}
export class SupplierError extends Error {
  constructor(
    readonly code: string,
    readonly rejected: boolean = false,
  ) {
    super('Supplier request failed (' + code + ').');
  }
}
export const activationSchema = z.object({
  ac: z
    .string()
    .min(10)
    .max(2000)
    .regex(/^LPA:1\$[a-zA-Z0-9.-]+\$[^\s$]+(?:\$[^\s$]*)?$/),
  iccid: z.string().regex(/^[0-9]{15,25}$/),
  esimTranNo: z.string().min(1).max(200),
});
export type Activation = z.infer<typeof activationSchema>;
export class SupplierClient {
  constructor(
    private access = process.env.ESIM_ACCESS_CODE || '',
    private secret = process.env.ESIM_SECRET_KEY || '',
  ) {}
  private async request(path: string, input: object): Promise<unknown> {
    if (!this.access || !this.secret) throw new Error('Supplier credentials unavailable.');
    const body = JSON.stringify(input),
      timestamp = String(Date.now()),
      requestId = randomUUID();
    const signature = createHmac('sha256', this.secret)
      .update(timestamp + requestId + this.access + body)
      .digest('hex');
    const response = await fetch('https://api.esimaccess.com/api/v1/open/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'RT-AccessCode': this.access,
        'RT-RequestID': requestId,
        'RT-Timestamp': timestamp,
        'RT-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new SupplierError('http_' + response.status);
    const result = z
      .object({
        success: z.boolean(),
        errorCode: z.union([z.string(), z.number()]).nullish(),
        obj: z.unknown(),
      })
      .parse(await response.json());
    if (!result.success) {
      const code = String(result.errorCode ?? 'unknown');
      throw new SupplierError(
        code,
        path === 'esim/order' &&
          ['200005', '200006', '200007', '200011', '310241', '310243', '310251'].includes(code),
      );
    }
    return result.obj;
  }
  async balance(): Promise<number> {
    const result = await this.request('balance/query', {});
    return z
      .object({ balance: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
      .parse(result).balance;
  }
  async order(
    transactionId: string,
    packageCode: string,
    wholesaleUnits: number,
    periodNum?: number,
  ): Promise<string> {
    z.string().min(1).max(50).parse(transactionId);
    z.string().min(1).max(200).parse(packageCode);
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(wholesaleUnits);
    if (periodNum !== undefined) z.number().int().min(1).max(365).parse(periodNum);
    const result = await this.request('esim/order', {
      transactionId,
      amount: wholesaleUnits,
      packageInfoList: [
        { packageCode, count: 1, price: wholesaleUnits, ...(periodNum ? { periodNum } : {}) },
      ],
    });
    return z.object({ orderNo: z.string().min(1).max(200) }).parse(result).orderNo;
  }
  async profile(
    orderNo: string,
    transactionId: string,
    packageCode: string,
  ): Promise<Activation | null> {
    let result: unknown;
    try {
      result = await this.request('esim/query', { orderNo, pager: { pageNum: 1, pageSize: 5 } });
    } catch (e) {
      if (e instanceof SupplierError && e.code === '200010') return null;
      throw e;
    }
    const profiles = z
      .object({
        esimList: z
          .array(
            z.object({
              orderNo: z.string(),
              transactionId: z.string().optional(),
              ac: z.string().nullish(),
              iccid: z.string().nullish(),
              esimTranNo: z.string(),
              smdpStatus: z.string(),
              packageList: z.array(z.object({ packageCode: z.string() })),
            }),
          )
          .max(1),
      })
      .parse(result).esimList;
    if (!profiles.length || !profiles[0].ac) return null;
    const p = profiles[0];
    if (
      p.orderNo !== orderNo ||
      (p.transactionId && p.transactionId !== transactionId) ||
      !p.packageList.some((item) => item.packageCode === packageCode) ||
      p.smdpStatus !== 'RELEASED'
    )
      throw new Error('Supplier profile does not match the order.');
    return activationSchema.parse(p);
  }
  async packages(
    filters: { packageCode?: string; locationCode?: string } = {},
  ): Promise<unknown[]> {
    if (!this.access || !this.secret) throw new Error('Supplier credentials unavailable.');
    const body = JSON.stringify({ type: 'BASE', ...filters });
    for (let attempt = 0; attempt < 4; attempt++) {
      const timestamp = String(Date.now()),
        requestId = randomUUID();
      const signature = createHmac('sha256', this.secret)
        .update(timestamp + requestId + this.access + body)
        .digest('hex');
      const response = await fetch('https://api.esimaccess.com/api/v1/open/package/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RT-AccessCode': this.access,
          'RT-RequestID': requestId,
          'RT-Timestamp': timestamp,
          'RT-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(45000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) throw new Error('Supplier catalogue unavailable.');
      const value = z
        .object({
          success: z.literal(true),
          obj: z.object({ packageList: z.array(z.unknown()).min(1).max(30000) }),
        })
        .safeParse(await response.json());
      if (!value.success) throw new Error('Invalid supplier catalogue response.');
      return value.data.obj.packageList;
    }
    throw new Error('Supplier catalogue unavailable.');
  }
}
