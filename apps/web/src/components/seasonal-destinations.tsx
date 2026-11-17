'use client';

import { useLocale, useTranslations } from 'next-intl';
import { inspirationPlace, inspirationPhotoCodes } from '@alozuri/shared/i18n/places';
import { destinationName } from '@alozuri/shared/i18n/destinations';
import { localeDirection } from '@alozuri/shared/i18n';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from '@/components/localized-link';
import { ArrowUpRight } from 'lucide-react';
import { countryFlag } from '@alozuri/shared';
import { seasonalInspiration } from '@alozuri/shared/destination-inspiration';

export function SeasonalDestinations({
  initial,
}: {
  initial: ReturnType<typeof seasonalInspiration>;
}) {
  const t = useTranslations('display');
  const photo = useTranslations('photoUi');
  const locale = useLocale();
  const [selection, setSelection] = useState(initial);
  useEffect(() => {
    // Static home pages still pick up the current collection after deployment.
    const current = seasonalInspiration(new Date());
    if (current.monthKey !== initial.monthKey) setSelection(current);
  }, [initial.monthKey]);
  function photoAlt(country: string) {
    const code = inspirationPhotoCodes.find((value) => value === country);
    return code ? photo(code) : t('photo', { country: destinationName(country, locale) });
  }
  return (
    <div className="seasonal-destinations" role="region" aria-label={t('seasonal')}>
      <div className="destination-grid" dir="ltr">
        {selection.destinations.map((destination) => (
          <Link
            key={destination.code}
            href={`/destinations/${destination.code.toLowerCase()}`}
            className="destination-card"
          >
            <Image
              className="destination-photo"
              src={`/images/${destination.image}.jpg`}
              alt={photoAlt(destination.code)}
              width={700}
              height={467}
              style={{ objectPosition: destination.position ?? 'center' }}
              sizes="(max-width: 900px) 45vw, 280px"
            />
            <div className="destination-copy" dir={localeDirection(locale)}>
              <span className="destination-flag" aria-hidden="true">
                {countryFlag(destination.code)}
              </span>
              <h3>
                {destinationName(destination.code, locale)}
                <ArrowUpRight size={18} aria-hidden="true" />
              </h3>
              <p>{inspirationPlace(destination.code, locale) ?? destination.place}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
