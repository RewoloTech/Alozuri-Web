export type InspirationDestination = {
  code: string;
  name: string;
  place: string;
  image: string;
  alt: string;
  position?: string;
};

export const inspirationDestinations = {
  JP: {
    code: 'JP',
    name: 'Japan',
    place: 'Kyoto',
    image: 'japan',
    alt: 'Traditional streets in Kyoto, Japan',
  },
  IT: {
    code: 'IT',
    name: 'Italy',
    place: 'Cinque Terre',
    image: 'italy',
    alt: 'Colourful coastal buildings in Cinque Terre, Italy',
  },
  US: {
    code: 'US',
    name: 'United States',
    place: 'New York',
    image: 'usa',
    alt: 'The Statue of Liberty in New York, United States',
  },
  TR: {
    code: 'TR',
    name: 'Turkey',
    place: 'Cappadocia',
    image: 'turkey-cappadocia',
    position: 'center 65%',
    alt: 'Hot-air balloons above the rock formations of Cappadocia, Turkey',
  },
  FR: {
    code: 'FR',
    name: 'France',
    place: 'Paris',
    image: 'france',
    alt: 'The Eiffel Tower in Paris, France',
  },
  CH: {
    code: 'CH',
    name: 'Switzerland',
    place: 'Swiss Alps',
    image: 'switzerland',
    alt: 'Snowy mountains and a frozen lake in Engadin, Switzerland',
  },
  TH: {
    code: 'TH',
    name: 'Thailand',
    place: 'Bangkok',
    image: 'thailand',
    position: 'center 45%',
    alt: 'Wat Arun beside the river in Bangkok, Thailand',
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    place: 'Sydney',
    image: 'australia',
    position: 'center 80%',
    alt: 'The Sydney Opera House on Sydney Harbour, Australia',
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    place: 'Rio de Janeiro',
    image: 'brazil',
    alt: 'Christ the Redeemer above Rio de Janeiro, Brazil',
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    place: 'Cape Town',
    image: 'south-africa',
    alt: 'Table Mountain in Cape Town, South Africa',
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    place: 'Dubai',
    image: 'uae',
    position: 'center top',
    alt: 'The Burj Khalifa in Dubai, United Arab Emirates',
  },
  EG: {
    code: 'EG',
    name: 'Egypt',
    place: 'Giza',
    image: 'egypt',
    alt: 'A pyramid in the desert at Giza, Egypt',
  },
} satisfies Record<string, InspirationDestination>;

export type InspirationSeason = 'winter' | 'spring' | 'summer' | 'autumn';
type Code = keyof typeof inspirationDestinations;
const selections: Record<InspirationSeason, readonly Code[]> = {
  winter: ['JP', 'FR', 'US', 'TR'],
  spring: ['JP', 'IT', 'TR', 'FR'],
  summer: ['JP', 'IT', 'US', 'TR'],
  autumn: ['JP', 'TR', 'TH', 'AE'],
};

// Editorial travel-planning seasons: November starts the winter collection.
// Use London consistently; this is not a claim about local weather or popularity.
export function seasonalInspiration(date: Date): {
  season: InspirationSeason;
  monthKey: string;
  destinations: InspirationDestination[];
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const season: InspirationSeason =
    month >= 11 || month <= 2 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn';
  // Keep Japan visible and preserve the curated order throughout each season.
  const codes = selections[season];
  return {
    season,
    monthKey: `${year}-${month}`,
    destinations: codes.map((code) => inspirationDestinations[code]),
  };
}
