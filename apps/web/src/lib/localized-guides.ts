import { cache } from 'react';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
import type { Locale } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import { guides, type Guide } from './guides';
type Key = keyof Messages['guideCopy'];
type GuideKeys = {
  slug: string;
  title: Key;
  description: Key;
  destinationLabel: Key;
  sections: readonly { heading: Key; paragraphs: readonly Key[] }[];
};
const guideKeys = [
  {
    slug: 'choose-usa-esim',
    title: 'usaTitle',
    description: 'usaDescription',
    destinationLabel: 'usaDestination',
    sections: [
      {
        heading: 'usaHeading1',
        paragraphs: ['usaParagraph1A', 'usaParagraph1B'],
      },
      {
        heading: 'usaHeading2',
        paragraphs: ['usaParagraph2A', 'usaParagraph2B'],
      },
      {
        heading: 'usaHeading3',
        paragraphs: ['usaParagraph3A', 'usaParagraph3B'],
      },
    ],
  },
  {
    slug: 'holiday-data-budget',
    title: 'budgetTitle',
    description: 'budgetDescription',
    destinationLabel: 'budgetDestination',
    sections: [
      {
        heading: 'budgetHeading1',
        paragraphs: ['budgetParagraph1A', 'budgetParagraph1B'],
      },
      {
        heading: 'budgetHeading2',
        paragraphs: ['budgetParagraph2A', 'budgetParagraph2B'],
      },
      {
        heading: 'budgetHeading3',
        paragraphs: ['budgetParagraph3A', 'budgetParagraph3B'],
      },
    ],
  },
  {
    slug: 'install-esim-before-travel',
    title: 'installTitle',
    description: 'installDescription',
    destinationLabel: 'installDestination',
    sections: [
      {
        heading: 'installHeading1',
        paragraphs: ['installParagraph1A', 'installParagraph1B'],
      },
      {
        heading: 'installHeading2',
        paragraphs: ['installParagraph2A', 'installParagraph2B'],
      },
      {
        heading: 'installHeading3',
        paragraphs: ['installParagraph3A', 'installParagraph3B'],
      },
    ],
  },
  {
    slug: 'avoid-roaming-charges',
    title: 'roamingTitle',
    description: 'roamingDescription',
    destinationLabel: 'roamingDestination',
    sections: [
      {
        heading: 'roamingHeading1',
        paragraphs: ['roamingParagraph1A', 'roamingParagraph1B'],
      },
      {
        heading: 'roamingHeading2',
        paragraphs: ['roamingParagraph2A', 'roamingParagraph2B'],
      },
      {
        heading: 'roamingHeading3',
        paragraphs: ['roamingParagraph3A', 'roamingParagraph3B'],
      },
    ],
  },
  {
    slug: 'esim-compatibility-activation',
    title: 'compatibilityTitle',
    description: 'compatibilityDescription',
    destinationLabel: 'compatibilityDestination',
    sections: [
      {
        heading: 'compatibilityHeading1',
        paragraphs: ['compatibilityParagraph1A', 'compatibilityParagraph1B'],
      },
      {
        heading: 'compatibilityHeading2',
        paragraphs: ['compatibilityParagraph2A', 'compatibilityParagraph2B'],
      },
      {
        heading: 'compatibilityHeading3',
        paragraphs: ['compatibilityParagraph3A', 'compatibilityParagraph3B'],
      },
    ],
  },
] as const satisfies readonly GuideKeys[];
/** Keep slugs, destinations and section structure aligned with the English source. */
export const localizedGuides = cache(async (locale: Locale): Promise<Guide[]> => {
  const copy = (await loadMessages(locale)).guideCopy;
  return guides.map((guide) => {
    const keys = guideKeys.find((candidate) => candidate.slug === guide.slug);
    if (!keys || keys.sections.length !== guide.sections.length)
      throw new Error('Missing guide translation structure.');
    return {
      ...guide,
      title: copy[keys.title],
      description: copy[keys.description],
      destinationLabel: copy[keys.destinationLabel],
      sections: keys.sections.map((section, index) => {
        if (section.paragraphs.length !== guide.sections[index].paragraphs.length)
          throw new Error('Missing guide paragraph translation.');
        return {
          heading: copy[section.heading],
          paragraphs: section.paragraphs.map((key) => copy[key]),
        };
      }),
    };
  });
});
