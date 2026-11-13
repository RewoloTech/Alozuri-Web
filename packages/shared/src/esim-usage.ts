export type UsageSnapshot = {
  kind: 'fixed' | 'daily' | 'unlimited';
  usedBytes: number | null;
  totalBytes: number | null;
  remainingBytes: number | null;
  profileStatus: string;
  smdpStatus?: string | null;
  esimTranNo?: string;
  expiresAt: string | null;
  checkedAt: string;
};
export type EsimUsage = {
  state: 'available' | 'pending' | 'unavailable';
  snapshot: UsageSnapshot | null;
  stale: boolean;
};

export function installationLabel(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    RELEASED: 'Ready to install',
    DOWNLOAD: 'Downloaded; installation not confirmed',
    INSTALLATION: 'Installed',
    ENABLED: 'Installed · enabled',
    DISABLED: 'Installed · disabled',
    DELETED: 'Deleted',
  };
  return status ? (labels[status] ?? 'Not reported') : 'Not reported';
}
