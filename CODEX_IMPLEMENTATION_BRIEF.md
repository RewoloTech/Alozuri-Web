# Implementation status

Live fixed-data supplier catalogue sync, daily scheduler, dynamic country selection, single-destination suggestions, Firebase verification gates/reset, and Stripe hosted test checkout/webhooks are implemented. See docs/commerce-testing.md for current behavior and configuration.

Stripe tests do not issue eSIMs. Remaining production work: real supplier ordering and reconciliation workers; secure activation delivery and usage; live payment/refund/dispute handling; final support/legal/account deletion/retention; controlled live issuance authorization and tests.

The historical readiness review in docs/readiness-review-2026-11-10.md predates these implementation changes. No live supplier purchase or real charge is authorized by automated Stripe tests.
