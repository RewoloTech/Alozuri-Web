/** Canonical source keys. Values are plain text/ICU, never executable HTML. */
export const englishMessages = {
  common: {
    language: 'Language',
    loading: 'Loading…',
    retry: 'Try again',
    save: 'Save',
    cancel: 'Cancel',
    back: 'Back',
    unavailableLanguage: 'This language is not available yet.',
  },
  navigation: {
    destinations: 'Destinations',
    howItWorks: 'How it works',
    help: 'Help centre',
    login: 'Log in',
    signup: 'Sign up',
    cart: 'Shopping cart',
    logout: 'Log out',
  },
  plans: {
    view: 'View plan',
    add: 'Add to cart',
    buy: 'Buy now',
    loadingPrice: 'Loading price…',
    unavailable: 'Price unavailable',
    allowance: 'Data allowance',
    validity: 'Validity',
    coverage: 'Coverage',
    days: '{count, plural, one {# day} other {# days}}',
  },
  checkout: {
    legalUnavailable:
      'Checkout and order documents are currently available in English. Switch to English to continue; your cart and currency will stay the same.',
    useEnglish: 'Continue in English',
    title: 'Checkout',
    deliveryEmail: 'Delivery email',
    emailHint: "We'll send your eSIM installation instructions here.",
    continue: 'Continue to payment',
    securePayment: 'Secure payment',
    apply: 'Apply code',
    remove: 'Remove code',
    promotionalCode: 'Promotional code',
    pay: 'Pay {amount}',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    catalogueChanged: 'The catalogue changed. Refresh your search.',
    searchPageInvalid: 'This search page is no longer valid. Start a new search.',
    promoInvalid: 'This promotional code is not valid.',
    promoExpired: 'This promotional code has expired.',
    authentication: 'Sign in to continue.',
    planUnavailable: 'This plan is no longer available.',
    paymentFailed: 'Payment could not be completed. Please try again.',
    paymentCancelled: 'Payment was cancelled.',
    rateLimited: 'Too many requests. Please wait and try again.',
  },
  account: { language: 'Preferred language', profile: 'Your profile', orders: 'Your orders' },
  installation: {
    title: 'Install your eSIM',
    wifi: 'Connect to Wi-Fi before installing.',
    private: 'Keep your installation details private.',
  },
  emails: {
    confirmationSubject: 'Your Alozuri eSIM order confirmation',
    confirmed: 'Your order is confirmed!',
    ready: 'Your eSIM is ready to install.',
    reference: 'Order reference: {reference}',
  },
  legal: {
    terms: 'Terms and Conditions',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    refunds: 'Refund and Cancellation Policy',
  },
} as const;
export type MessageDomain = keyof typeof englishMessages;
export type Messages = {
  [D in MessageDomain]: { [K in keyof (typeof englishMessages)[D]]: string };
};
