import { z } from 'zod';
import {
  LEGAL_VERSION,
  LEGAL_EFFECTIVE_DATE,
  EARLY_SUPPLY_REQUEST,
  CANCELLATION_ACKNOWLEDGEMENT,
  type CheckoutLegalAcceptance,
} from '../../../../packages/shared/src/legal.ts';
import { POLICIES, policyText } from '../../../../packages/shared/src/policies.ts';
export const checkoutLegalSchema = z
  .object({
    version: z.literal(LEGAL_VERSION),
    termsAccepted: z.literal(true),
    immediateSupplyRequested: z.literal(true),
    cancellationAcknowledged: z.literal(true),
  })
  .strict();
export const legalSnapshotSchema = z.object({
  version: z.string().max(40),
  effectiveDate: z.string(),
  acceptedAt: z.string(),
  termsAccepted: z.literal(true),
  immediateSupplyRequested: z.literal(true),
  cancellationAcknowledged: z.literal(true),
  requestText: z.string(),
  acknowledgementText: z.string(),
  termsText: z.string(),
  refundText: z.string(),
});
export type LegalSnapshot = z.infer<typeof legalSnapshotSchema>;
export function legalSnapshot(
  input: CheckoutLegalAcceptance,
  now = new Date().toISOString(),
): LegalSnapshot {
  const accepted = checkoutLegalSchema.parse(input);
  return {
    ...accepted,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    acceptedAt: now,
    requestText: EARLY_SUPPLY_REQUEST,
    acknowledgementText: CANCELLATION_ACKNOWLEDGEMENT,
    termsText: policyText(POLICIES.terms),
    refundText: policyText(POLICIES.refunds),
  };
}
