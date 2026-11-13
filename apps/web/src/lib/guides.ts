export type Guide = {
  slug: string;
  title: string;
  description: string;
  destination: string;
  destinationLabel: string;
  sections: { heading: string; paragraphs: string[] }[];
};
export const guides: Guide[] = [
  {
    slug: 'choose-usa-esim',
    title: 'How to choose an eSIM for the United States',
    description:
      'A practical checklist for comparing USA eSIM coverage, data allowances, validity and compatibility before buying.',
    destination: '/destinations/us',
    destinationLabel: 'Compare USA eSIM plans',
    sections: [
      {
        heading: 'Start with your itinerary, not the cheapest headline price',
        paragraphs: [
          'A plan for the United States is not automatically a plan for Canada or Mexico. Write down every country where you need data, including a stopover if you intend to leave the airport. Use single-destination search for a USA-only trip and the multi-country planner for more stops.',
          'For UK travellers, compare the travel eSIM with your home carrier’s actual roaming offer. Do not assume that a domestic allowance can be used abroad at the same price.',
        ],
      },
      {
        heading: 'Compare like with like',
        paragraphs: [
          'Compare a fixed allowance such as 10 GB with other fixed allowances over the full length of your trip. A daily allowance is a different product: check whether it resets, reduces speed or stops data after the stated daily limit. Do not compare either with an unlimited label without reading its fair-use conditions.',
          'Check validity and the activation trigger together. A cheaper 7-day plan may not cover a 10-day visit, and a plan that begins on installation can start before you fly. Networks, restrictions and the country list are shown in the plan’s specifications when supplied.',
        ],
      },
      {
        heading: 'Check the exact phone and delivery details',
        paragraphs: [
          'Confirm that your exact device model supports eSIM and is unlocked by your carrier. An eSIM-capable model name is not enough if the regional variant or carrier lock prevents installation.',
          'Use an email address you can access over Wi-Fi. Keep the secure order link and installation credentials private. Before purchase, read the refund policy: installation or activation can affect cancellation eligibility.',
        ],
      },
    ],
  },
  {
    slug: 'holiday-data-budget',
    title: 'How much mobile data do you need for a 7-day or 14-day holiday?',
    description:
      'Estimate a travel data budget from your own phone usage, trip length, Wi-Fi access and allowance type.',
    destination: '/destinations',
    destinationLabel: 'Compare destinations and data allowances',
    sections: [
      {
        heading: 'Use your own recent usage as the starting point',
        paragraphs: [
          'Open your phone’s mobile-data settings and note the measurement period. If it covers a month, do not mistake that total for a week. Look at the apps you expect to use while travelling and distinguish mobile data from Wi-Fi use.',
          'For an arithmetic example—not a usage promise—500 MB each day is about 3.5 GB over seven days or 7 GB over fourteen days, using decimal units. A 20% buffer would make those estimates about 4.2 GB and 8.4 GB. Your actual use may be very different.',
        ],
      },
      {
        heading: 'Identify what could change abroad',
        paragraphs: [
          'Navigation, messaging and booking confirmations behave differently from long video sessions, video calls or tethering a laptop. Background photo backups, system updates and app downloads can consume data without an obvious browsing session.',
          'Download maps, media and large files over Wi-Fi where practical. Check app settings for automatic downloads and cloud backups. If you plan to share a connection, first confirm the selected package’s hotspot restrictions; do not assume all plans allow the same use.',
        ],
      },
      {
        heading: 'Match both allowance and validity',
        paragraphs: [
          'A fixed 10 GB allowance lasts until it is used or the package expires, according to its conditions. A 1 GB-per-day product has daily rules and may not let unused allowance carry forward. Check the exact reset or fair-use wording.',
          'Choose enough validity for the trip and check when it starts. Leave a practical buffer for changed travel plans; an allowance that looks sufficient is not useful after the plan’s validity has ended. Usage readings supplied by the network may be delayed, so your device’s counters are useful for day-to-day monitoring.',
        ],
      },
    ],
  },
  {
    slug: 'install-esim-before-travel',
    title: 'Can you install an eSIM before travelling?',
    description:
      'Understand installation versus activation, check the plan’s start rule and prepare your QR code or manual details safely.',
    destination: '/esim-compatibility',
    destinationLabel: 'Check eSIM compatibility and installation',
    sections: [
      {
        heading: 'Installation and activation are different checks',
        paragraphs: [
          'There is no universal yes or no. Some packages start validity when purchased, some when installed, and others on the first supported network connection. Read the rule for your purchased plan before scanning its QR code.',
          'If installation starts validity, installing days before departure can use up part of the plan before your trip. If a plan starts on a supported network connection, follow its installation instructions and do not assume it can be stored indefinitely: check any download or activation deadline too.',
        ],
      },
      {
        heading: 'Prepare before opening the QR code',
        paragraphs: [
          'Confirm device compatibility and carrier unlock status, then connect to reliable Wi-Fi. Open the secure order link from your delivery email. If you need to scan a QR code, display it on another screen; use the supplied manual installation details when appropriate.',
          'Label the new profile clearly so you can distinguish it from your home SIM. Keep the QR code and activation credentials private, and avoid deleting an installed profile: a profile may be installable only once.',
        ],
      },
      {
        heading: 'At your destination',
        paragraphs: [
          'Select the travel eSIM for mobile data and follow the plan’s instructions for that profile’s roaming setting. Separately review your home SIM’s data roaming and automatic data switching settings.',
          'Installation or activation can affect refund eligibility even if you have not deliberately used data. Read the refund policy before installation and contact support if the supplied activation rule is unclear.',
        ],
      },
    ],
  },
  {
    slug: 'avoid-roaming-charges',
    title: 'How to avoid unexpected roaming charges abroad',
    description:
      'Check your home SIM settings, compare roaming costs and select a travel eSIM without assuming every type of charge is covered.',
    destination: '/destinations',
    destinationLabel: 'Compare travel data plans',
    sections: [
      {
        heading: 'Check what your home carrier actually charges',
        paragraphs: [
          'Before travelling, check your carrier’s terms for the exact destination. A daily roaming pass, an included allowance and pay-as-you-go roaming can have very different costs. Note whether calls, SMS and data are charged separately.',
          'Compare the cost for the length of your trip with a suitable travel eSIM. Use the price after any valid discount, the stated currency and the full validity period. Do not assume a travel eSIM is always cheaper for every traveller.',
        ],
      },
      {
        heading: 'Keep the two SIM profiles separate',
        paragraphs: [
          'Choose the travel eSIM as your mobile-data line. Follow that eSIM’s own roaming instructions: some travel profiles need data roaming enabled to connect to their supported network.',
          'For your home SIM, disable data roaming and automatic mobile-data switching if you want to avoid its roaming data use. The exact settings vary by device. Keeping the home line enabled for calls or texts can still involve home-carrier charges; a data-only travel eSIM does not remove those charges.',
        ],
      },
      {
        heading: 'Prevent background surprises',
        paragraphs: [
          'Use Wi-Fi for large downloads, updates and photo backups. Check which apps are allowed to use mobile data and whether a hotspot-connected device may download updates.',
          'Check the selected plan’s fair-use rules and monitor usage. A supplier reading can be delayed; it is not a real-time guarantee of the remaining balance. If you cross into another country, confirm that it is explicitly included before relying on the same plan.',
        ],
      },
    ],
  },
  {
    slug: 'esim-compatibility-activation',
    title: 'eSIM compatibility and activation: what to check before buying',
    description:
      'Check your exact device variant, carrier unlock status, plan activation rules and safe installation steps.',
    destination: '/esim-compatibility',
    destinationLabel: 'Open the compatibility and installation checklist',
    sections: [
      {
        heading: 'Check the exact model, region and carrier lock',
        paragraphs: [
          'Use the manufacturer’s specifications for your exact model and country of purchase. A model family may include regional variants with different SIM support. Check for an Add eSIM option, but also verify manufacturer support and carrier unlock status.',
          'If your phone is locked, ask the carrier about eligibility and timing before buying a travel profile. Do not assume an unlock can be completed after you arrive or simply because the device supports eSIM hardware.',
        ],
      },
      {
        heading: 'Read the package conditions before installing',
        paragraphs: [
          'Confirm the countries you need, allowance type, validity, activation trigger and any download deadline. Check the supplier’s network list and restrictions where supplied; missing network or speed information is not a promise.',
          'A data-only plan does not establish a local telephone number, voice service or SMS entitlement. If you need those services, check your home carrier’s terms separately.',
        ],
      },
      {
        heading: 'Install safely and keep a recovery path',
        paragraphs: [
          'Connect to Wi-Fi, open the secure installation details from your order and follow the instructions for the actual package. Keep access to the delivery email and do not share activation credentials with other people.',
          'If the connection fails, confirm the data line, coverage and supplied roaming/APN instructions before deleting the profile. Contact Alozuri support with your order reference; never send full card details or passwords. The compatibility page and refund policy provide the next steps and applicable conditions.',
        ],
      },
    ],
  },
];
