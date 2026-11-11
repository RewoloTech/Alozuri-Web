AGENTS.md — Alozuri engineering instructions
These instructions apply to the entire Alozuri repository. Follow them whenever writing, reviewing, refactoring, or testing code. More specific AGENTS.md files in subdirectories may add rules but must not relax security or correctness requirements.
1. Project and objective
   Alozuri is an international eSIM storefront built with Next.js, TypeScript, Firebase, Stripe, and an eSIM supplier integration (eSIM Access). The customer experience must be accessible, fast, responsive, consistent, and safe for real payments.
Primary rule: Implement working, tested functionality—not merely attractive UI or placeholder flows. Do not claim code, payments, supplier connectivity, or tests are working unless verified.
2. Before changing code
1. Inspect the existing repository selectively: start with the files and scripts relevant to the requested change. Review package.json, routing, types, environment conventions, Firebase rules, Stripe handlers, supplier adapters, and tests only to the extent the task touches them; expand investigation when necessary for safety or correctness.
2. Reuse existing patterns and components unless they are defective. Avoid unnecessary rewrites or dependencies.
3. Identify the source of truth for products, coverage, prices, currency, cart, orders, and authentication.
4. For multi-file work, make a short plan, then implement it in the current task. Do not stop at planning.
5. Preserve existing public routes and behaviours unless the task explicitly requires changing them.
6. Code quality and architecture
   - Write maintainable, strictly typed TypeScript. Avoid any, unchecked casts, duplicated logic, and dead code.
   - Keep components small and focused; separate presentation, state, domain logic, API routes, and infrastructure integrations.
   - Validate untrusted inputs at server boundaries using the repository's existing schema-validation approach.
   - Make loading, empty, error, success, and disabled states explicit.
   - Use deterministic helpers for prices, coverage checks, currency minor units, and order transitions; unit-test them.
   - Prefer server components for read-only pages where appropriate. Use client components only for interactive behaviour.
   - Follow the existing Next.js App Router or Pages Router structure; do not introduce a parallel routing architecture.
   - Never expose private keys or supplier credentials through NEXT_PUBLIC_*, browser bundles, responses, or logs.
   - Avoid console.log of customer details, payment identifiers, tokens, QR codes, or secrets.
   - Update relevant documentation, types, and tests with each behavioural change.
7. Alozuri design and accessibility
   - Retain the existing Alozuri visual identity: white/light-grey surfaces, dark navy text, violet/blue primary actions, restrained lime accents, subtle borders, and consistent rounded corners.
   - Prefer clear typography, compact cards, obvious pricing, restrained motion, and one prominent primary action per context.
   - Build mobile-first; check at 375px, 390px, 768px, and desktop widths. No horizontal overflow.
   - Use semantic HTML, associated form labels, visible keyboard focus, helpful validation messages, and accessible dialogs.
   - Target WCAG 2.2 AA; test keyboard use, screen-reader-relevant labels, contrast, and reduced-motion preferences.
   - No fake trust marks, unsupported claims, hard-coded prices in live commerce, or decorative controls that do nothing.
8. Destination search invariants
   - Single destination mode permits exactly one selected country.
   - Multi-country trip mode permits two or more selected countries; show removable destination chips.
   - When two or more countries are selected, the interface must not indicate that single-destination mode is active.
   - Switching to single-destination mode from multiple countries must request an explicit choice of one country; do not silently drop destinations.
   - A multi-country match must cover every selected country according to verified supplier coverage. Never label partial coverage as complete.
   - Distinguish selected itinerary countries from the full list of countries included in a regional plan.
   - Keep mode, selection, result query, and URL state consistent across refresh and back/forward navigation.
   - No fabricated networks, coverage, activation policies, or supplier availability.
9. Cart and checkout invariants
   - Provide an accessible site-wide cart entry, quantity indicator, cart page, and empty-cart state.
   - Store exact supplier product/variant identifiers with cart items. Revalidate items on the server before creating payment.
   - Guest cart should persist across page refreshes; authenticated cart should sync securely and merge predictably on sign-in.
   - Quantities, totals, removal, and currency changes must update consistently. Browser-side totals are for display only.
   - Guest checkout must work; creating an account must not be mandatory.
   - Display clear order details, coverage, allowance, duration, customer email, any applicable taxes, and final total before payment.
   - Add to cart continues browsing; Buy now goes directly toward checkout. Both must use the same backend purchasing logic.
   - Never accept a client-provided price as authoritative. Calculate totals server-side using verified pricing, correct currency minor units, and applicable tax rules.
   - Test products/demonstration prices must never be purchasable in production.
10. Stripe, Apple Pay, and Google Pay
    - Use official Stripe integrations. Prefer the Payment Element with the Express Checkout Element for eligible Apple Pay/Google Pay wallet buttons when compatible with the existing implementation.
    - Use server-created PaymentIntents, idempotency keys, validated amounts/currencies, and verified Stripe webhook signatures.
    - Wallet buttons must be rendered only when available for the current browser/device/customer and account configuration.
    - Document HTTPS and Stripe payment method domain registration for the actual checkout domains.
    - Do not create separate wallet gateways or duplicate fulfilment paths.
    - Handle declined payments, abandoned checkout, retries, processing states, and webhook replay safely.
    - A redirect to /checkout/success is not evidence of payment. Only verified server-side Stripe state may authorise fulfilment.
    - Never store raw card data in Firebase or expose Stripe secret keys.
11. Supplier ordering and fulfilment
    - Supplier API requests run server-side only. Use documented endpoints and verified product identifiers; never invent API fields or responses.
    - Model order states explicitly and validate transitions. Recommended states include pending_payment, payment_processing, paid, fulfilment_pending, fulfilling, fulfilled, fulfilment_failed, refund_pending, refunded, cancelled.
    - Use transactional/atomic fulfilment claims so concurrent webhooks cannot order the same eSIM twice.
    - Persist an immutable order reference, supplier references, processing attempts, timestamps, and safely sanitised errors.
    - A supplier timeout means the outcome may be unknown: reconcile with the supplier before attempting another chargeable purchase.
    - Keep paid-but-unfulfilled orders recoverable with appropriate retry/reconciliation controls.
    - Protect QR codes, activation credentials, personal information, and order details with strict access controls.
    - Never assume usage balances, networks, validity, or activation behaviour that supplier data does not confirm.
12. Firebase security
    - Enforce ownership and least privilege in Firestore Security Rules and backend access.
    - Ensure an unauthenticated customer cannot enumerate or retrieve another customer's orders or eSIM credentials.
    - Validate webhook/service-account operations server-side. Do not trust user-settable payment or fulfilment status fields.
    - Use environment-specific Firebase and Stripe configuration; isolate test and production data.
    - Keep credentials out of Git. Provide .env.example with placeholder variable names only, not live values.
13. Required testing for each change
    Use risk-based validation. Discover existing commands in package.json; do not assume scripts exist. Start with fast, focused checks for changed code; run broader suites for high-risk changes (especially payments, pricing, supplier fulfilment, access control, or migrations) and before shipping when feasible. Avoid repeatedly running unchanged, lengthy suites after each small edit.
14. Static checks: lint, TypeScript typecheck, formatting check (if configured).
15. Unit tests: cover all new domain logic and edge cases.
16. Integration tests: cover affected API boundaries and relevant cart, order, or provider behaviour with controlled mocks.
17. End-to-end tests: cover affected high-value user journeys in a browser using the project's configured test runner, especially payment and fulfilment paths.
18. Build: run the production build when feasible, especially for changes to routing, deployment, API contracts, or shared modules.
19. Manual visual review: for UI changes, inspect desktop/mobile layouts, empty/loading/error states, keyboard navigation, and relevant interaction paths.
    If a necessary command or credential is unavailable, report NOT RUN and the reason. Never invent a passing test result.
    Mandatory regression scenarios for destination/commerce changes
    - Choose France as single destination; adding Switzerland activates multi-country mode; adding Italy retains all three.
    - Switching back to single destination requires choosing one country explicitly.
    - Verify multi-country search excludes any plan missing even one selected country.
    - Reload/back/forward restores consistent search state.
    - Add/remove cart items, change quantities, reload, log in, and merge carts without lost or duplicated items.
    - Changing currency reprices all items; final server amount matches the Stripe intent.
    - Guest checkout succeeds in Stripe test mode with a correctly linked order.
    - A failed/cancelled payment never triggers supplier fulfilment.
    - Duplicate/reordered Stripe webhook delivery cannot duplicate supplier orders.
    - Supplier timeout/unknown response cannot initiate blind repeat purchases.
    - Paid but unfulfilled order is visible and recoverable.
    - Apple Pay and Google Pay appear only on eligible devices/browsers; card checkout remains available.
    - E2E test checkout on small mobile widths and confirm no inaccessible controls.
20. Resourcefulness, speed, and efficient execution
    - Optimize for completing the actual user request promptly without compromising correctness, security, or payment safety. Spend less time narrating, more time implementing.
    - Be resourceful: use existing utilities, patterns, local documentation, code search, working examples, and installed dependencies before building anything new or adding packages.
    - Search narrowly first. Inspect relevant files and call sites instead of repeatedly scanning or reading the entire repository. Expand only when findings justify it.
    - For straightforward fixes, act immediately. For complex changes, write a brief actionable plan (3–5 steps maximum) and execute it in the same task; do not get stuck in repeated planning or analysis.
    - Prefer the smallest complete, maintainable change over unnecessary abstraction, large refactors, speculative features, or polishing unrelated screens.
    - Batch independent inspections or checks when practical, and avoid repeated tool calls, duplicate searches, or rerunning identical commands without a reason.
    - Use focused tests first to identify failures quickly. After corrections, rerun affected tests and perform broader regression checks proportionate to the risk; never skip essential checkout, pricing, data-access, payment, or fulfilment safeguards to save time.
    - If one approach is blocked, try a reasonable alternative using the available code and tools. If external access or credentials are missing, implement testable local parts, report the blocked integration honestly, and continue with unblocked work.
    - Make sensible decisions from existing requirements; do not ask unnecessary questions when a safe, reversible default is clear. Ask only when a missing decision could materially affect money movement, security, user data, or irreversible changes.
    - Do not repeatedly report progress without changes. Give concise updates for meaningful milestones or genuine blockers; the final response should focus on results and verification.
    - Do not trade speed for fabricated outputs: never claim a test ran, a payment worked, or an API call succeeded without direct verification.
21. Working process and completion report
    - Implement the requested change completely; add or adjust tests near the relevant code.
    - Fix errors found in code you changed; do not conceal failing checks.
    - When API keys or live supplier access are unavailable, build safe interfaces with test mocks, but clearly mark live integration as blocked/unverified. Do not turn on real purchases prematurely.
    - At completion, provide a concise report with:
      1. Files changed and functionality implemented.
      2. Actual commands/tests executed and their outcomes.
      3. Any manual checks performed.
      4. Outstanding risks, configuration, and production blockers.
    - Do not say "production-ready" or "fully tested" unless evidence supports that claim.