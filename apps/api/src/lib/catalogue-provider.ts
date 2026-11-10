import type { StoredPlan } from '../../../../packages/shared/src/index.ts';
import { adaptPackage, SupplierClient } from './supplier.js';

// Each provider owns its mapping, identifiers and credentials. Sync owns persistence.
export interface CatalogueProvider {
  readonly id: string;
  fetch(syncedAt: string): Promise<{ fetched: number; plans: StoredPlan[] }>;
}
export class EsimAccessCatalogue implements CatalogueProvider {
  readonly id = 'esim-access';
  constructor(private supplier = new SupplierClient()) {}
  async fetch(syncedAt: string) {
    const source = await this.supplier.packages();
    return {
      fetched: source.length,
      plans: source
        .map((p) => adaptPackage(p, syncedAt))
        .filter((p): p is StoredPlan => p !== null),
    };
  }
}
