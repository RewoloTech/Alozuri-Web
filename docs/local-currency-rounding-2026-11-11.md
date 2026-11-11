# Bounded GBP/EUR retail rounding — 11 November 2026

The owner approved cleaner local retail endings after reviewing the rule and
example prices. USD catalogue prices, supplier costs and canonical pricing
metadata remain unchanged; no migration or supplier sync is required for this
presentation rule.

`apps/api/src/lib/exchange-rates.ts` remains the single conversion function used
by public search, product detail, featured bundles, cart quotes and checkout.

- Convert the canonical USD amount with verified rational FX, rounding upwards
  to whole local minor units and respecting Stripe's charge minimum.
- Keep amounts at or below £5/€5 precise.
- Above that threshold, consider the next `.49`/`.99` ending only when its
  increase over the precise conversion is no more than 3%.
- Require that ending to be strictly lower than the precise conversion of the
  next 50-cent canonical USD price step. Otherwise retain the precise amount.
  This prevents cosmetic rounding from collapsing distinct standard prices.
- Nonstandard manual USD amounts retain precise conversion. Canonical automatic
  prices and value adjustments use 50-cent steps; their order and distinctions
  are preserved by the bound.

All money and cap checks use integer/BigInt arithmetic. USD stays unchanged.
Already-created payment/order snapshots retain their original totals. A stale
checkout quote must pass the existing expected-total check before a new payment
can be created; the rule does not rewrite existing purchases or refunds.

## Preview against the production catalogue

3,179 public products were checked in GBP and EUR. At the verified FX snapshot,
1,045 GBP and 1,274 EUR prices qualified for a cosmetic increase. Every proposed
price was at least the precise conversion, within the 3% cap, and unchanged for
small amounts. Other prices retain their exact conversion.

| Default 10 GB bundle | Previous GBP | Proposed GBP | Proposed EUR |
| -------------------- | -----------: | -----------: | -----------: |
| Europe               |        £8.26 |        £8.49 |        €9.99 |
| Asia                 |       £19.16 |       £19.49 |       €22.99 |
| North America        |       £18.41 |       £18.49 |       €22.01 |
| Global               |       £37.20 |       £37.49 |       €44.49 |

The North America EUR offer deliberately stays precise: rounding to €22.49
would cross the raw converted value of the next canonical USD price step.
Not every price should have a cosmetic ending when the agreed safeguards fail.
US 500 MB/day and 1 GB/day remain distinct low-priced offers.

## Validation and release

The focused pricing suite passed 23 tests, including 16,008 GBP/EUR price-step
comparisons, threshold/cap boundaries, all four proposed GBP examples and
server search/detail parity with the actual rounded amounts. Full unit,
Firestore and Stripe test-mode results and the production rollout are recorded
below when complete. Live verification stops at quotes and pre-payment screens;
no real payment or supplier purchase is part of this release.
