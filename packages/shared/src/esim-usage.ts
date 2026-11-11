export type UsageSnapshot = {
  kind: 'fixed' | 'daily' | 'unlimited';
  usedBytes: number | null;
  totalBytes: number | null;
  remainingBytes: number | null;
  profileStatus: string;
  expiresAt: string | null;
  checkedAt: string;
};
export type EsimUsage = {
  state: 'available' | 'pending' | 'unavailable';
  snapshot: UsageSnapshot | null;
  stale: boolean;
};
