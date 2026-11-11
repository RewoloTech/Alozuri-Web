'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { countryFlag } from '@voyaspan/shared';
import { seasonalInspiration } from '@voyaspan/shared/destination-inspiration';

export function SeasonalDestinations({
  initial,
}: {
  initial: ReturnType<typeof seasonalInspiration>;
}) {
  const [selection, setSelection] = useState(initial);
  useEffect(() => {
    // Static home pages still pick up the current collection after deployment.
    const current = seasonalInspiration(new Date());
    if (current.monthKey !== initial.monthKey) setSelection(current);
  }, [initial.monthKey]);
  return (
    <div
      className="seasonal-destinations"
      role="region"
      aria-label="Seasonal destination inspiration"
    >
      <div className="destination-grid">
        {selection.destinations.map((destination) => (
          <Link
            key={destination.code}
            href={`/destinations/${destination.code.toLowerCase()}`}
            className="destination-card"
          >
            <Image
              className="destination-photo"
              src={`/images/${destination.image}.jpg`}
              alt={destination.alt}
              width={700}
              height={467}
              style={{ objectPosition: destination.position ?? 'center' }}
              sizes="(max-width: 900px) 45vw, 280px"
            />
            <div className="destination-copy">
              <span className="destination-flag" aria-hidden="true">
                {countryFlag(destination.code)}
              </span>
              <h3>
                {destination.name}
                <ArrowUpRight size={18} aria-hidden="true" />
              </h3>
              <p>{destination.place}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
