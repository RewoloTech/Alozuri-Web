import { cache } from 'react';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
import type { Locale } from '@alozuri/shared/i18n';
import type { Messages } from '@alozuri/shared/i18n/messages';
import type { DestinationContent } from './destination-content';
type Key = keyof Messages['destinationCopy'];
type ContentKeys = {
  title: Key;
  description: Key;
  intro: Key;
  tips: readonly Key[];
  faq: readonly { question: Key; answer: Key }[];
};
const keys = {
  US: {
    title: 'USTitle',
    description: 'USDescription',
    intro: 'USIntro',
    tips: ['USTip1', 'USTip2', 'USTip3'],
    faq: [
      {
        question: 'USQuestion1',
        answer: 'USAnswer1',
      },
      {
        question: 'USQuestion2',
        answer: 'USAnswer2',
      },
    ],
  },
  GB: {
    title: 'GBTitle',
    description: 'GBDescription',
    intro: 'GBIntro',
    tips: ['GBTip1', 'GBTip2', 'GBTip3'],
    faq: [
      {
        question: 'GBQuestion1',
        answer: 'GBAnswer1',
      },
      {
        question: 'GBQuestion2',
        answer: 'GBAnswer2',
      },
    ],
  },
  JP: {
    title: 'JPTitle',
    description: 'JPDescription',
    intro: 'JPIntro',
    tips: ['JPTip1', 'JPTip2', 'JPTip3'],
    faq: [
      {
        question: 'JPQuestion1',
        answer: 'JPAnswer1',
      },
      {
        question: 'JPQuestion2',
        answer: 'JPAnswer2',
      },
    ],
  },
  TH: {
    title: 'THTitle',
    description: 'THDescription',
    intro: 'THIntro',
    tips: ['THTip1', 'THTip2', 'THTip3'],
    faq: [
      {
        question: 'THQuestion1',
        answer: 'THAnswer1',
      },
      {
        question: 'THQuestion2',
        answer: 'THAnswer2',
      },
    ],
  },
  TR: {
    title: 'TRTitle',
    description: 'TRDescription',
    intro: 'TRIntro',
    tips: ['TRTip1', 'TRTip2', 'TRTip3'],
    faq: [
      {
        question: 'TRQuestion1',
        answer: 'TRAnswer1',
      },
      {
        question: 'TRQuestion2',
        answer: 'TRAnswer2',
      },
    ],
  },
  AE: {
    title: 'AETitle',
    description: 'AEDescription',
    intro: 'AEIntro',
    tips: ['AETip1', 'AETip2', 'AETip3'],
    faq: [
      {
        question: 'AEQuestion1',
        answer: 'AEAnswer1',
      },
      {
        question: 'AEQuestion2',
        answer: 'AEAnswer2',
      },
    ],
  },
} as const satisfies Record<string, ContentKeys>;
function hasDestination(code: string): code is keyof typeof keys {
  return Object.hasOwn(keys, code);
}
export const localizedDestinations = cache(
  async (locale: Locale): Promise<Partial<Record<string, DestinationContent>>> => {
    const copy = (await loadMessages(locale)).destinationCopy;
    return Object.fromEntries(
      Object.keys(keys).map((code) => {
        if (!hasDestination(code)) throw new Error('Missing destination translation structure.');
        const fields = keys[code];
        return [
          code,
          {
            title: copy[fields.title],
            description: copy[fields.description],
            intro: copy[fields.intro],
            tips: fields.tips.map((key) => copy[key]),
            faq: fields.faq.map((faq) => ({
              question: copy[faq.question],
              answer: copy[faq.answer],
            })),
          },
        ];
      }),
    );
  },
);
