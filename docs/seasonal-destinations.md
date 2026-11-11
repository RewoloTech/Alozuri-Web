# Seasonal destination inspiration

The homepage shows a simple four-card grid, retaining the original layout. The winter order is Japan (Kyoto), France (Paris), United States (New York) and Turkey (Cappadocia balloons). There are no carousel arrows, swipe hints or automatic slides. Japan remains first in every season; Switzerland is retained in the image library without a featured position.

Selections change automatically by London travel-planning season: November–February winter, March–May spring, June–August summer and September–October autumn. Spring shows Japan, Italy, Turkey and France; summer shows Japan, Italy, United States and Turkey; autumn shows Japan, Turkey, Thailand and United Arab Emirates. The curated seasonal order stays stable across reloads and throughout the season. These are editorial suggestions, not live popularity rankings or weather guarantees.

The browser checks the current collection on mount so statically built pages update without deployment. An already open page updates on reload. All cards retain the existing country destination routes. The image library contains twelve countries, with attribution in `apps/web/public/ASSET_SOURCES.md`.

Selection logic lives in `packages/shared/src/destination-inspiration.ts`; presentation is in `apps/web/src/components/seasonal-destinations.tsx`. Node tests cover London month boundaries, four unique destinations, Japan in every season and the preferred winter order. Browser checks cover seasonal updates, stable reload order, image loading, keyboard links and layouts at 375, 390, 768 and 1440px. Catalogue availability, pricing and checkout are unchanged. Changes remain local and have not been deployed.

Validation for this revision: lint, TypeScript, production build, two focused Node tests, two focused Playwright tests, formatting and diff checks passed. Mobile and desktop screenshots were visually reviewed. The previous full browser suite was not repeated for this layout revision.
