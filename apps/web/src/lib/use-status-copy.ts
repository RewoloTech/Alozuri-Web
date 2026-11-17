'use client';
import { useTranslations } from 'next-intl';
import type { Messages } from '@alozuri/shared/i18n/messages';
type StatusKey = keyof Messages['status'];
const orderStatuses: Record<string, StatusKey> = {
  created: 'awaitingPayment',
  checkout_pending: 'awaitingPayment',
  pending_payment: 'awaitingPayment',
  payment_processing: 'processing',
  paid: 'paid',
  fulfilling: 'fulfilling',
  fulfilment_pending: 'fulfilling',
  provision_wait: 'fulfilling',
  ready: 'ready',
  fulfilled: 'ready',
  provision_error: 'deliveryIssue',
  fulfilment_failed: 'deliveryIssue',
  refund_pending: 'refundPending',
  refunded: 'refunded',
  cancelled: 'cancelled',
  expired: 'expired',
  attention: 'attention',
  payment_failed: 'failed',
};
const profileStatuses: Record<string, StatusKey> = {
  CREATE: 'preparing',
  PAYING: 'preparing',
  PAID: 'preparing',
  GETTING_RESOURCE: 'preparing',
  GOT_RESOURCE: 'ready',
  IN_USE: 'active',
  USED_UP: 'depleted',
  UNUSED_EXPIRED: 'expired',
  USED_EXPIRED: 'expired',
  CANCEL: 'cancelled',
  SUSPENDED: 'suspended',
  REVOKE: 'revoked',
};
const installationStatuses: Record<string, StatusKey> = {
  RELEASED: 'readyInstall',
  DOWNLOAD: 'downloaded',
  INSTALLATION: 'installed',
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  DELETED: 'deleted',
};
/** Labels only; supplier readings never determine refund eligibility here. */
export function useStatusCopy() {
  const t = useTranslations('status');
  const label = (values: Record<string, StatusKey>, code?: string | null) =>
    t(code && Object.hasOwn(values, code) ? values[code] : 'notReported');
  return {
    order: (code: string) => label(orderStatuses, code),
    profile: (code: string) => label(profileStatuses, code),
    installation: (code?: string | null) => label(installationStatuses, code),
    notReported: t('notReported'),
  };
}
