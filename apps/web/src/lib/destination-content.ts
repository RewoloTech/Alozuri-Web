export type DestinationContent = {
  title: string;
  description: string;
  intro: string;
  tips: string[];
  faq: { question: string; answer: string }[];
};
export const destinationContent: Record<string, DestinationContent> = {
  US: {
    title: 'USA travel eSIMs for trips from the UK and beyond',
    description:
      'Compare USA travel eSIM data plans by allowance, validity, current price and activation. Check US coverage before a single-country or multi-stop trip.',
    intro:
      'Travelling from the UK to the USA? Compare prepaid data for maps, messaging and travel bookings without assuming your home roaming allowance applies. Choose a USA-only plan or check every stop on a wider itinerary.',
    tips: [
      'Choose a validity period that covers your arrival and departure, then check when its clock starts.',
      'A United States plan does not automatically include Canada or Mexico. Add those stops to the trip planner if you need them.',
      'For a 10 GB comparison, use the allowance filter and compare validity and data policy as well as price.',
    ],
    faq: [
      {
        question: 'Will a USA eSIM work on my UK phone?',
        answer:
          'Your exact phone model must support eSIM and be carrier unlocked. Check the manufacturer and your carrier before buying; the country you bought your phone in does not guarantee compatibility.',
      },
      {
        question: 'Does a USA eSIM include a US phone number?',
        answer:
          'The plans shown here provide mobile data. Do not assume a local number, ordinary voice calls or SMS are included. Internet calling and messaging use your data allowance.',
      },
    ],
  },
  GB: {
    title: 'UK travel eSIMs for tourists and American travellers',
    description:
      'Compare United Kingdom prepaid travel eSIM data, validity and current prices. Check device compatibility, networks and activation for your UK visit.',
    intro:
      'Visiting the United Kingdom from the United States or another country? Use the plan list to compare mobile data for travel directions, bookings and staying in touch. Check that your phone is unlocked before paying.',
    tips: [
      'If your US phone is financed or locked to a carrier, ask the carrier about unlock eligibility before your trip.',
      'Travelling onward to Europe? A UK-only plan will not automatically cover your next country; compare a multi-country itinerary.',
      'Check each plan’s country list rather than assuming nearby islands or territories are included.',
    ],
    faq: [
      {
        question: 'Can Americans buy a UK travel eSIM?',
        answer:
          'You can compare and purchase a plan as a guest. Your phone must support the supplied eSIM profile and be carrier unlocked; your home nationality does not establish device compatibility.',
      },
      {
        question: 'Is the UK included in a Europe eSIM?',
        answer:
          'Only when the specific plan lists the United Kingdom. A regional name alone is not proof of coverage; check the included countries before buying.',
      },
    ],
  },
  JP: {
    title: 'Japan travel eSIM data plans',
    description:
      'Compare Japan travel eSIM allowances, validity, current prices and supplier activation rules. Check supported networks and compatibility before your trip.',
    intro:
      'Planning a trip to Japan? Budget mobile data for navigation between places, translating text, messaging and checking reservations. Compare fixed allowances with daily plans and read what happens when a daily allowance is used.',
    tips: [
      'Download maps and large language packs over Wi-Fi before departure to reduce mobile data use.',
      'Do not assume every plan starts on arrival. Read the supplied activation rule before installing.',
      'For a wider Asia trip, add every destination instead of assuming a Japan plan includes other countries.',
    ],
    faq: [
      {
        question: 'Can I install a Japan eSIM before flying?',
        answer:
          'It depends on the plan’s activation rule. Installation can start validity on some profiles, so check the purchased plan before scanning the QR code.',
      },
      {
        question: 'Which Japanese networks can I use?',
        answer:
          'Use the networks reported for the specific plan. If the supplier has not provided network information, Alozuri does not promise a particular operator or speed.',
      },
    ],
  },
  TH: {
    title: 'Thailand tourist eSIM data plans',
    description:
      'Compare Thailand travel eSIM data allowances, validity and current prices. Read network, activation and daily-limit details for your holiday.',
    intro:
      'Choose Thailand travel data around your holiday length and the way you use your phone. Maps, transfers, messaging and video do not use the same amount of data; compare the allowance and validity together.',
    tips: [
      'For a 7-day holiday, check whether validity starts at purchase, installation or the first supported network connection.',
      'A daily plan may reduce speed or stop data after its daily allowance; read its stated policy.',
      'If you are also visiting another country, add it to the planner so every stop must be covered.',
    ],
    faq: [
      {
        question: 'Is a tourist eSIM the same as a local voice SIM?',
        answer:
          'The Alozuri plans shown here are data-only. Do not assume they include a local phone number or SMS.',
      },
      {
        question: 'Does unlimited mean no restrictions?',
        answer:
          'No. Where a plan uses that label, read the supplier’s fair-use and speed restrictions. A fixed or daily allowance may be easier to compare.',
      },
    ],
  },
  TR: {
    title: 'Turkey travel eSIM data plans',
    description:
      'Compare Turkey eSIM data plans and current prices for UK travellers and other visitors. Review coverage, validity and activation before purchasing.',
    intro:
      'Travelling from the UK to Turkey? Compare a Turkey-specific data plan rather than relying on a regional label or assuming your home roaming bundle covers the trip.',
    tips: [
      'Read the actual country list: the word Europe on another plan does not by itself establish Turkey coverage.',
      'Use Wi-Fi for backups and downloads, then budget mobile data for navigation and messaging.',
      'Keep your home SIM’s data roaming and automatic data switching off if you want to avoid its roaming use.',
    ],
    faq: [
      {
        question: 'Will a Europe eSIM cover Turkey?',
        answer:
          'Only if Turkey appears in that specific plan’s included-country list. Build an itinerary including Turkey to compare plans that cover it.',
      },
      {
        question: 'How do I avoid home-network roaming charges?',
        answer:
          'Select the travel eSIM for mobile data and follow its roaming instructions. Separately disable data roaming and automatic data switching for your home SIM; home-carrier call and SMS charges can still apply.',
      },
    ],
  },
  AE: {
    title: 'UAE travel eSIM data plans',
    description:
      'Compare UAE travel eSIM data allowances, validity, activation and current prices. Check plan conditions for your visit to the United Arab Emirates.',
    intro:
      'Visiting the United Arab Emirates? Choose a data allowance and validity period for your stay, then read the supplier’s activation and network details. Keep a copy of essential bookings available offline.',
    tips: [
      'For a stopover, check the full validity period and when the plan starts rather than choosing only by data size.',
      'Mobile data does not guarantee that every calling or messaging application is available at your destination.',
      'For onward travel, check each country in the itinerary planner instead of assuming a UAE plan provides regional coverage.',
    ],
    faq: [
      {
        question: 'Does a UAE eSIM include ordinary phone calls?',
        answer:
          'The plans shown here are data-only. Check your home-carrier terms if you intend to use the home SIM for ordinary voice calls or SMS.',
      },
      {
        question: 'Can I rely on a named network or speed?',
        answer:
          'Only networks actually supplied for the selected package are listed. Coverage and speeds depend on the location, device and network conditions; no fixed speed is promised.',
      },
    ],
  },
};
