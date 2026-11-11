import assert from 'node:assert/strict';
import { adaptPackage } from '../../src/lib/supplier.js';

// Service attributes verified in the read-only supplier catalogue on 2026-11-11.
const raw = {
  packageCode: 'fixture',
  name: 'United States 1GB/Day',
  price: 7500,
  currencyCode: 'USD',
  volume: 1073741824,
  smsStatus: 2,
  dataType: 2,
  unusedValidTime: 180,
  duration: 1,
  durationUnit: 'DAY',
  durationType: 1,
  location: 'US',
  locationCode: 'US',
  description: 'United States 1GB/Day',
  descriptionList: [],
  saleNote: '',
  activeType: 2,
  cancelPolicy: 2,
  favorite: false,
  retailPrice: 15000,
  speed: '3G/4G/5G',
  ipExport: 'US',
  supportTopUpType: 3,
  fupPolicy: '512 Kbps',
  locationNetworkList: [
    {
      locationCode: 'US',
      operatorList: [
        { operatorName: 'Verizon', networkType: '5G' },
        { operatorName: 'AT&T', networkType: '5G' },
      ],
    },
  ],
};
export function supplierFixture(patch: Record<string, unknown> = {}) {
  const source = { ...raw, ...patch };
  if (!('description' in patch)) source.description = source.name;
  const plan = adaptPackage(source, new Date().toISOString());
  assert.ok(plan);
  return plan;
}
