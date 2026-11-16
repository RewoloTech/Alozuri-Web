# Homepage cleanup

The homepage shares a simplified headline, delivery/roaming benefits row and
planner across screen sizes. Repetitive hero copy, planner headings, destination
labels, trip-matcher badge and coverage note are omitted. The allowance filter
keeps its accessible name and native options in a compact dropdown.

The `simplified` Planner presentation is enabled only on the homepage. Other
landing pages retain their existing planner presentation. Desktop keeps generous
hero spacing and its existing navigation; the existing 600px mobile breakpoint
uses tighter spacing for faster access to search. Chips, removal controls,
explicit single-country choice, coverage matching and URL state are retained.
Demo disclosures, loading/error states and consent controls remain available.

Validate with `npm run test:e2e -- tests/e2e/mobile-home.spec.ts tests/e2e/shopping.spec.ts`.
The tests check mobile through desktop widths and record homepage and selected
planner screenshots in `/tmp` for visual review. Deployment is frontend only.

On screens using the collapsed navigation (up to 1000px), guest Log in and Sign up appear
side by side below a divider in the hamburger menu. Sign up links to the existing
`/register` route and closes the menu when followed. Desktop login and signed-in account controls are
retained. The homepage tab reads “Multi-country” while its accessible name stays
“Multi-country trip”. The four-benefit strip uses standard 16px normal-weight Inter text with
a tighter line height to improve readability within the existing spacing.
