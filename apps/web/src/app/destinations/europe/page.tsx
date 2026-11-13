import Link from 'next/link';
import { Planner } from '@/components/planner';
import { CountryOffers } from '@/components/country-offers';
import { DestinationAdvice } from '@/components/destination-advice';
import { getItineraryPlans } from '@/lib/catalogue-server';
import { publicMetadata, breadcrumbs, jsonLd } from '@/lib/seo';
export const revalidate = 300;
const itinerary = ['FR', 'DE', 'IT'];
export const metadata = publicMetadata(
  'Europe multi-country travel eSIMs',
  'Compare Europe travel eSIM data plans for a multi-country trip. Check each plan’s countries, current price, validity and activation; regional coverage varies.',
  '/destinations/europe',
);
export default async function Europe() {
  const plans = await getItineraryPlans(itinerary);
  return (
    <section className="container section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbs('Europe travel eSIMs', '/destinations/europe')),
        }}
      />
      <div className="page-intro">
        <span className="eyebrow">MULTI-COUNTRY TRAVEL DATA</span>
        <h1>Europe eSIMs for your itinerary</h1>
        <p>
          Travelling from the USA or elsewhere to several European countries? Compare one data plan
          against your actual stops. Europe is a regional label, not a guarantee that every European
          country is included.
        </p>
        <p>
          The example plans below cover <strong>France, Germany and Italy</strong>. Open each
          country list for its full coverage, or change the itinerary in the planner. No plan is
          labelled as covering all of Europe.
        </p>
      </div>
      <CountryOffers code={itinerary.join(',')} coverage="all" initial={plans} />
      <Planner initialCountries={itinerary} />
      <DestinationAdvice
        content={{
          title: 'Europe travel data',
          description: '',
          intro: '',
          tips: [
            'Add every country you will visit, including stopovers where you need mobile data.',
            'Do not assume the UK, Switzerland or Turkey is included just because a package says Europe.',
            'For a Europe eSIM 10 GB comparison, select that allowance and compare validity and the full coverage list. Check hotspot support in the supplied plan conditions if you need it.',
          ],
          faq: [
            {
              question: 'Can one eSIM cover multiple European countries?',
              answer:
                'Yes, when its verified coverage list includes every country in your trip. The planner requires every selected country to be covered; a local plan for only one stop is not a complete match.',
            },
            {
              question: 'Do I need to install a separate eSIM in each country?',
              answer:
                'A single regional profile may cover multiple countries, according to that package’s coverage and activation conditions. Check the plan rather than assuming the same network operator or speed everywhere.',
            },
          ],
        }}
      />
      <p>
        Visiting one country? Compare <Link href="/destinations/gb">UK travel eSIMs</Link> or{' '}
        <Link href="/destinations">all destinations</Link>.
      </p>
    </section>
  );
}
