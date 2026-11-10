# Implementation status

Alozuri supports a live fixed-data supplier catalogue, Firebase verified accounts, and Stripe Embedded Checkout in test and live modes. Live confirmed payments queue a durable eSIM Access delivery job. The worker uses a stable supplier transaction ID, validates allocated profiles, and stores installation details separately for verified owner access. Definite supplier rejection triggers a refund; ambiguous timeouts retry the original supplier transaction.

See docs/production-checkout.md for production configuration and rollout limits, and docs/commerce-testing.md for test checkout. Tests never place real supplier orders or create real charges.

Implementation checks include unit/API coverage and local Firestore emulator tests for atomic job creation, concurrent leases and replay protection. Production access, live keys, webhooks, schedules and an explicitly budgeted real purchase still need verification. Legal/support pages retain draft content and must be completed by the business before customer launch.
