import { POLICIES_V1 } from './policies-v1.ts';
import { BUSINESS, LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from './legal.ts';
export type PolicySection = { title: string; paragraphs: string[] };
export type Policy = {
  slug: string;
  path: string;
  title: string;
  description: string;
  sections: PolicySection[];
};
const section = (title: string, ...paragraphs: string[]): PolicySection => ({ title, paragraphs });
export const POLICIES: Record<string, Policy> = {
  terms: {
    slug: 'terms',
    path: '/terms',
    title: 'Terms and Conditions',
    description:
      'The terms for buying and using Alozuri travel eSIM data plans, including payment, activation, support and consumer rights.',
    sections: [
      section(
        'Who we are and these terms',
        BUSINESS.identity,
        `Our registered office is ${BUSINESS.address}. Contact ${BUSINESS.email}. These terms apply to purchases from ${BUSINESS.site}; the plan information and refund policy presented with your order form part of your contract.`,
      ),
      section(
        'Eligibility',
        'Purchasers must be at least 18 and able to enter a contract. If purchasing for someone else or a business, you must have authority and explain the plan restrictions to the user. These terms do not remove any mandatory protections that apply to a consumer.',
      ),
      section(
        'Accounts and guest purchases',
        'Guest checkout is available. If you create an account, provide accurate information, use a strong password and keep access secure. Firebase Authentication supports our account service. Tell us promptly about suspected unauthorised access; you remain entitled to challenge unauthorised charges.',
      ),
      section(
        'What we sell',
        'Alozuri sells one-off prepaid international travel eSIM data plans. The plan page and checkout identify the allowance, validity, included countries and available supplier conditions. Data-only plans do not provide a local telephone number or ordinary cellular calls/SMS unless the specific product expressly says otherwise.',
      ),
      section(
        'Our role and connectivity partners',
        'Your purchase contract is with Rewolo Technologies Ltd trading as Alozuri. We currently integrate with eSIM Access for catalogue and provisioning. Mobile connectivity relies on third-party suppliers, roaming partners and local network operators; this does not transfer our own contractual obligations to you or remove your consumer rights.',
      ),
      section(
        'Ordering and contract formation',
        'Review the plan, compatibility, activation rule, final currency/total, contact email and legal notices before paying. Continuing to the payment form is not proof of payment. An accepted, successfully paid order forms the purchase contract; the server verifies Stripe payment state before authorising fulfilment. We provide an order reference and contractual confirmation.',
      ),
      section(
        'Availability and fulfilment',
        'Listed products are subject to supplier availability and revalidation. The server checks the selected package and price before payment. After verified payment, we request allocation and provide installation details when the supplier confirms them. Pending or failed allocation is not a successful delivery; contact us if it is not resolved. If we cannot supply, we will arrange the remedy or refund required by law.',
      ),
      section(
        'Prices and currencies',
        'The final checkout total and currency are the amount you authorise. The implemented catalogue base is USD; GBP/EUR may be offered when enabled, using server-side reference-rate conversion and retail rounding. Your bank or payment provider may separately charge currency/cross-border fees. A changed price must be reviewed before a new payment is confirmed.',
      ),
      section(
        'Taxes and charges',
        'The amount shown at checkout is the total collected by Alozuri. We must disclose any applicable taxes/mandatory charges before you pay and will not add an undisclosed surcharge afterwards. The current checkout has no separate tax line added; this statement is not a claim of VAT registration or tax exemption.',
      ),
      section(
        'Payment through Stripe',
        'Stripe processes payment details. Card fields and eligible Apple Pay/Google Pay authorisation are handled through Stripe; wallet availability depends on your device, browser and payment-provider configuration. We do not store full card numbers or security codes in Firestore. You must authorise the displayed payment; a declined attempt does not itself complete an order.',
      ),
      section(
        'Fraud and verification',
        'We and payment providers may check transactions, investigate suspicious activity and request proportionate verification. We may refuse or suspend a transaction where reasonably necessary for security, legal obligations or suspected fraud. We do not ask you to send full card details, passwords or installation credentials by email/chat.',
      ),
      section(
        'Compatible, unlocked devices',
        'Before buying, confirm that the exact device model and region support eSIM, the carrier lock permits another operator, and the device is usable in every destination. An “Add eSIM” setting alone is not a universal guarantee. Our compatibility guide is informational; manufacturer/carrier confirmation is preferable when uncertain.',
      ),
      section(
        'Checking your intended use',
        'Select the correct destinations, allowance, duration and activation trigger. Included coverage must match your itinerary: a regional plan can include more countries than you selected. Keep any home SIM needed for your usual number; your home carrier may charge for its separate services.',
      ),
      section(
        'Installation requirements',
        'Use a reliable internet connection to download the profile and follow the instructions supplied with your order. Device menus vary. Do not delete an installed profile while troubleshooting unless support/manufacturer instructions confirm it is safe. We cannot promise that a profile can be transferred or reinstalled without supplier confirmation.',
      ),
      section(
        'Activation and validity triggers',
        'Validity can start on purchase, installation, or first supported network connection, according to the particular supplier product. Read the rule before paying or installing. In particular, purchase-triggered plans may start before travel; do not assume that all plans wait until arrival.',
      ),
      section(
        'Allowances, expiry and renewal',
        'Fixed plans provide the stated total allowance; daily plans have a daily limit/policy; expressly unlimited plans remain subject to disclosed conditions. Service ends when the applicable allowance or validity expires under the plan rules. There is no automatic renewal/subscription implemented for these one-off purchases, and unused allowance does not imply rollover.',
      ),
      section(
        'Destinations and geographic restrictions',
        'Use is limited to the destinations and permitted networks shown for the product. A country list does not promise signal at every address, on every network, at sea or in the air. Local laws, identity/registration requirements, sanctions or roaming restrictions may affect availability; we do not invent network lists where the supplier has not supplied them.',
      ),
      section(
        'Coverage and outages',
        'Local network operators control radio coverage and much of the connectivity infrastructure. Coverage maps or advertised speeds, where provided, are indicative, not guarantees. Congestion, maintenance, infrastructure outages, roaming arrangements, device support and local regulation can affect service. We remain responsible for our own descriptions, reasonable care and skill, and applicable remedies.',
      ),
      section(
        'Speed and technology',
        'A reference to 4G/5G does not promise a constant speed or access to that technology everywhere. Your device, location, signal, local operator, congestion and fair-use restrictions affect performance. We do not guarantee undisclosed minimum speeds or uninterrupted service.',
      ),
      section(
        'Unlimited and fair use',
        'Unlimited does not mean unlimited full-speed data. Some plans have a stated high-speed amount each day followed by reduced speed; others stop at the daily limit. Cards and product conditions distinguish fixed, daily cutoff and continuing reduced-speed data. Review the specific fair-use/speed information before buying.',
      ),
      section(
        'Calls and messages',
        'Our current mapped products are data-only. Internet calling/messaging apps may work over data, subject to local restrictions, but this is not a promise of a telephone number, ordinary SMS, emergency calling or access to every app/service. Keep an alternative method of contacting emergency services.',
      ),
      section(
        'Hotspot and tethering',
        'Hotspot/tethering is available only where the device, operator and specific plan permit it. Do not assume an undisclosed tethering allowance or unrestricted use in routers/modems. Ask support if the plan does not confirm a feature you need.',
      ),
      section(
        'QR codes and activation credentials',
        'Treat the QR code, activation string and private order link as confidential. Share them only with the intended authorised user where permitted. We protect access through account/guest-order checks; you should also secure your email and device. Never post installation credentials in public chat or screenshots.',
      ),
      section(
        'Installation limits and removal',
        'Some profiles are intended for one installation/device and may not be recoverable after deletion. Exact transfer, reinstall and installation-window rules must come from the product/supplier; we do not assume a universal policy. Contact us before deleting or transferring a profile.',
      ),
      section(
        'Top-ups and extensions',
        'Do not assume that a plan can be topped up, extended, renewed or switched to a different device. These features are not presently offered as an automatic storefront flow. Any future purchase must disclose its own price and conditions before authorisation.',
      ),
      section(
        'Cancellation and refunds',
        'Read the Refund and Cancellation Policy. Delivery of a QR code, installation or activation does not automatically remove statutory rights. Service and digital-content cancellation rules differ; we do not treat order placement as an express request or acknowledgement removing cancellation rights. Faulty, misdescribed or unusable products remain subject to mandatory remedies.',
      ),
      section(
        'Email and delivery information',
        'Check your email address carefully and tell us promptly if it is wrong or a message is missing. Check spam folders and your private order/account page. We will investigate delivery issues and verify ownership before disclosing installation information. Incorrect information does not remove rights relating to an error within our control.',
      ),
      section(
        'Interruptions and support',
        'Tell us about connection problems while you can still provide useful diagnostic information. We may ask for the order reference, device model, destination and non-sensitive error details. We cannot control every local operator outage, but will investigate matters within our role and provide legally required remedies rather than excluding all responsibility.',
      ),
      section(
        'Acceptable use',
        'Use the service lawfully and follow applicable plan/network restrictions. Do not commit fraud, abuse or attacks; interfere with networks; resell access without permission; or use stolen payment/profile credentials. See the Acceptable Use Policy and disclosed fair-use rules.',
      ),
      section(
        'Suspension and termination',
        'We may restrict an account or service where reasonably necessary for unlawful use, fraud, security threats or a material contract breach, subject to applicable law. We will explain where lawful and practicable and consider a proportionate response. Suspension does not automatically extinguish prepaid balances or refund rights; contact us to challenge an error.',
      ),
      section(
        'Intellectual property',
        'Our branding and website materials belong to us or their licensors. You may use the website and supplied installation instructions for your legitimate purchase/use, but must not copy branding, impersonate Alozuri or bypass security. Third-party marks remain their owners’ marks and are not endorsements.',
      ),
      section(
        'Third-party websites and services',
        'Links to manufacturers, payment providers or hosted support sites may have their own privacy/usage terms. We identify optional support before you open it. External terms do not override our obligations under your purchase contract or the law.',
      ),
      section(
        'Responsibility and limits',
        'Nothing excludes liability for death/personal injury caused by negligence, fraud/fraudulent misrepresentation, defective or misdescribed products where liability cannot be excluded, or any other non-excludable obligation. For consumers, we remain responsible for foreseeable loss caused by our breach and applicable lack of reasonable care/skill. We do not impose a blanket purchase-price cap or make all network problems your risk. Loss not reasonably foreseeable or business losses from personal-use purchases may be treated differently where the law permits.',
      ),
      section(
        'Complaints and disputes',
        `Contact ${BUSINESS.email} with your order reference and the issue, without full payment or activation credentials. We will investigate and explain our proposed resolution. We do not claim membership of an ADR scheme or regulatory certification. If a complaint cannot be resolved, we will provide any dispute-resolution information required by applicable law; court and regulator rights remain available.`,
      ),
      section(
        'Governing law and international consumers',
        'English law governs these terms, subject to mandatory protections applicable to consumers in their country of residence. Nothing requires a consumer to give up a court or legal protection that cannot lawfully be waived, including applicable rights in Scotland, Northern Ireland or another country. We do not promise identical regulatory treatment in every destination.',
      ),
      section(
        'Changes and contact',
        `The version accepted for an order applies to that order; later website changes do not retrospectively remove its rights. Future terms may change, with a new version/effective date. We will notify you and obtain agreement where a material change to an existing contract legally requires it. Contact ${BUSINESS.email}, or write to the registered office above.`,
      ),
    ],
  },
  privacy: {
    slug: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'How Alozuri handles account, order, payment, support and technical information and how to exercise your privacy rights.',
    sections: [
      section(
        'Controller and contact',
        `${BUSINESS.identity} Rewolo Technologies Ltd is the controller for personal information processed to operate Alozuri. Contact ${BUSINESS.email} or write to ${BUSINESS.address}. We do not publish a data-protection registration number or claim a certification that has not been verified.`,
      ),
      section(
        'Information we handle',
        'Account information includes email, name/profile details, Firebase user identifiers, verification state and sign-in information. Orders include selected products, quantities, price/currency, timestamps, references, payment/fulfilment/refund status and legal acceptance records. Private installation records can include an eSIM ICCID and activation credentials. Support includes what you choose to send. Technical/security data can include IP address, request information, browser/device details and service error events.',
      ),
      section(
        'Purposes and lawful bases',
        'We process account, order, delivery and necessary support information to perform a contract or take requested pre-contract steps. We use legal-obligation grounds for required accounting, regulatory and consumer-rights records. Security, fraud prevention, troubleshooting and proportionate business administration rely on legitimate interests where appropriate and subject to your rights. Optional support preferences rely on consent; consent is not a condition of shopping or ordinary email support.',
      ),
      section(
        'Authentication',
        'Firebase Authentication provides email/password and supported Google sign-in. Firebase manages password authentication and token persistence; the storefront does not put your password in an order record. Account sessions are checked on the server for protected operations. You may use guest checkout instead; a private guest link/token is still needed for secure order access.',
      ),
      section(
        'Orders, payment and delivery',
        'Stripe handles card/wallet payment details and payment-related security information. We retain the payment references/status and amount needed to manage your order, not full card numbers or security codes in Firestore. eSIM Access receives supplier-order identifiers and information necessary for provisioning; the current purchase API does not send your support message or full card information to the eSIM supplier. Installation details are private and must not be shared publicly.',
      ),
      section(
        'Providers and recipients',
        'Verified application integrations include Google/Firebase for hosting, authentication and database services; Stripe for payments; eSIM Access for catalogue/provisioning; Resend for transactional eSIM/order email; and optional Tawk.to hosted support. Provider roles can differ: payment/network providers may act independently for some purposes. We may disclose necessary information to professional advisers, authorities or a successor where lawful and proportionate. We do not sell personal information.',
      ),
      section(
        'Email, Zoho and communications',
        `Use ${BUSINESS.email} for support, complaints and rights requests. Transactional delivery is configured through Resend, including esim@alozuri.com as sender. The domain’s incoming email is routed through Zoho’s EU mail service, so messages you send to our support address may be handled there. Transactional order email is handled separately by Resend.`,
      ),
      section(
        'Cookies, analytics and marketing',
        'The Cookie Policy describes essential/session storage and optional support choices. This release does not run Google Analytics, advertising pixels or a marketing subscription flow. We do not treat accepting Terms or buying a plan as consent to marketing. New optional tracking must be disclosed and gated by the appropriate consent before use.',
      ),
      section(
        'Support privacy',
        'Optional Tawk.to chat opens in an isolated third-party frame after your support choice and an explicit chat action. It appears in the corner on desktop and full screen on mobile. Its code runs separately from Alozuri account/checkout content. The frame sends no referrer and does not include your order token, email or installation details. Tawk handles what you enter there under its own service/privacy arrangements. Email support remains available without optional consent. Never send passwords, full card details, QR codes or activation strings in an initial support message.',
      ),
      section(
        'International processing',
        'Selected application hosting is configured in the Netherlands, but this is not a promise that all data stays in one country. Authentication, payment, email, network and support providers may process information in the UK, EEA and other countries. Restricted international transfers require an applicable lawful transfer mechanism, such as adequacy or approved contractual safeguards. Ask us about the arrangements relevant to your request. You can ask us for information about the recipients and transfer safeguards relevant to your personal data.',
      ),
      section(
        'Retention',
        'We keep account information while needed for your account and legitimate unresolved matters, and installation/order access information while needed to supply the plan, support it and resolve disputes. Accounting and transaction records may need to be kept for statutory accounting/tax periods, commonly six years for company records; a legal hold can require longer. Support records are retained only as needed for the enquiry, related complaint or legal obligation. Current Google Cloud application-log storage is configured for 30 days; its required audit-log bucket is configured for 400 days. Other providers apply their own retention arrangements. You may ask us to review or delete information that is no longer needed; required records and proportionate legal holds are exceptions. We do not promise that closing a browser or withdrawing cookies deletes your order records.',
      ),
      section(
        'Your rights',
        `Depending on the circumstances, you may request access, correction, erasure, restriction, portability or object to processing; you can withdraw optional consent in Cookie settings. Email ${BUSINESS.email}. We may need proportionate proof of identity to protect others’ information. We respond within the applicable legal time limit, normally one month, subject to lawful extensions/pauses. Erasure does not require deletion of records we must lawfully retain, and withdrawing support consent does not erase an earlier provider conversation automatically.`,
      ),
      section(
        'Security and automated decisions',
        'We use account/guest-order access checks, server validation, restricted database access and verified payment webhooks. Public clients cannot directly read/write Firestore in the deployed rules. No system can promise absolute security. Payment providers may use fraud signals; our application does not provide a separate automated credit-scoring service. Contact us to challenge a transaction restriction and ask for an explanation or human review where applicable.',
      ),
      section(
        'Children',
        'Our purchasing service is directed to adults aged 18 and over. We do not ask for children’s personal data for marketing. If you believe a child has provided data improperly, contact us so we can investigate and take appropriate steps. The fact that a third-party account can be created does not establish eligibility to purchase.',
      ),
      section(
        'Complaints and updates',
        'You can complain to the UK Information Commissioner’s Office at https://ico.org.uk/make-a-complaint/ or another competent supervisory authority. We welcome the opportunity to address an issue first without limiting your complaint rights. Changes are published with a version/effective date; legally required notices or renewed consent will be provided where applicable.',
      ),
    ],
  },
  cookies: {
    slug: 'cookies',
    path: '/cookies',
    title: 'Cookie Policy',
    description:
      'Alozuri’s actual cookies and browser storage, necessary functions, optional support and how to change your choices.',
    sections: [
      section(
        'Scope',
        'Cookies and similar technologies include local storage, session storage and browser databases. The controls below cover optional functionality on Alozuri. Necessary storage remains available to support security and features you request; refusing optional support does not prevent shopping or email support.',
      ),
      section(
        'Your choices',
        'Choose Accept all, Reject optional or Customise choices. Optional support is off until you choose it. Your choice is recorded in the first-party alozuri_consent cookie, with the notice version and time, for up to 180 days; it is also used to remember a refusal. Cookie settings in the footer can reopen the controls at any time. A changed notice, invalid record or expired preference asks again. Clearing browser storage can reset the choice.',
      ),
      section(
        'Essential and requested preference storage',
        'alozuri-cart stores the guest basket in localStorage; related alozuri-cart-owner, alozuri-cart-merge and alozuri-cart-pending-{account} entries support authenticated merge/retry. They persist until replaced, cleared, account changes or browser deletion; they do not currently have a verified fixed automatic expiry. alozuri-currency stores your requested currency until changed/cleared. These are not advertising profiles.',
      ),
      section(
        'Session and order access storage',
        'alozuri-search remembers itinerary state in sessionStorage. alozuri-checkout-attempt prevents accidental duplicate checkout creation; alozuri-order-{reference}, alozuri-purchased-{reference} and alozuri-cleared-{reference} support private order access/cart reconciliation. Session storage normally lasts for that tab/session and can be restored by some browsers. Guest-order tokens are access credentials: do not share private links or expose them in screenshots.',
      ),
      section(
        'Firebase Authentication',
        'Firebase uses its own browser persistence (commonly the firebaseLocalStorageDb IndexedDB database) for requested account sign-in and token state. Exact keys/lifetimes depend on the Firebase SDK and browser; sessions can persist until sign-out, revocation, browser cleanup or provider expiry. We do not describe a Firebase measurement ID as an Analytics cookie, because the code does not initialise Analytics.',
      ),
      section(
        'Stripe payment security',
        'Stripe loads when you request the payment step, not as an optional advertising tag. Stripe may use __stripe_mid and __stripe_sid for fraud prevention; its published lifetimes are commonly one year and 30 minutes respectively, subject to provider/browser changes. Additional payment/wallet storage may depend on the method/browser. See https://stripe.com/legal/cookies-policy for the provider’s current details. Payment cookies are not used by this application to run advertising.',
      ),
      section(
        'Optional support',
        'The optional category is Tawk.to customer support. Allowing it enables chat; the provider is contacted only when you open the panel. Tawk runs inside a sandboxed frame on its separate origin, not in the parent Alozuri account/checkout page. The provider may use cookies/storage within that frame; exact provider names/lifetimes were not verified locally. See https://www.tawk.to/privacy-policy/. Withdrawing support permission removes the active frame and stops future loading until permission is given again. Use Tawk’s privacy controls for data already held there.',
      ),
      section(
        'Analytics, advertising and Cloudflare',
        'This release does not run analytics or advertising tags. Any future optional tracking will require updated information and the appropriate prior choice. Hosting, proxy or CDN security features can use their own essential technologies if enabled; names/durations vary by provider and configuration. We do not claim that a particular Cloudflare tracking cookie is installed on your device without observing it.',
      ),
      section(
        'Browser controls and contact',
        `You can also use your browser’s cookie/storage controls. Blocking necessary storage can prevent sign-in, basket persistence or private order access; optional refusal alone does not. For questions, contact ${BUSINESS.email}. Self-hosted fonts and destination images avoid those former third-party asset requests on ordinary site visits.`,
      ),
    ],
  },
  refunds: {
    slug: 'refunds',
    path: '/refund-policy',
    title: 'Refund and Cancellation Policy',
    description:
      'How to cancel an Alozuri order, report a delivery or connection problem, and request the remedies available under consumer law.',
    sections: [
      section(
        'Your rights come first',
        'This policy applies to Alozuri purchases and does not limit mandatory consumer rights. It is not a blanket no-refund policy. Supplier restrictions do not override remedies owed by Alozuri for its own breach, defective/misdescribed supply or other non-excludable obligations. Installation or QR-code delivery alone is not an automatic waiver.',
      ),
      section(
        'How to request cancellation or help',
        `Email ${BUSINESS.email} with your order reference, contact email and a short explanation. State clearly if you wish to cancel. You do not have to use a particular form or provide a reason where an applicable statutory change-of-mind right permits cancellation without one. Do not include full card details, passwords or activation credentials.`,
      ),
      section(
        'Cancellation period and legal classification',
        'UK distance-contract cancellation rights commonly run for 14 days from contract conclusion for services or intangible digital content, subject to the legal rules and exceptions. An eSIM purchase can involve connectivity services and digital profile delivery; classification must be assessed for the specific supply rather than assumed from the QR format. Mandatory rights in your country may differ and are preserved.',
      ),
      section(
        'Delivery and cancellation rights',
        'Plans are normally supplied after successful payment. Placing an order, receiving a QR code, installing a profile or confirming device compatibility is not treated as a waiver of statutory cancellation or remedy rights. Contact support promptly if you wish to cancel or report a problem.',
      ),
      section(
        'Digital content versus services',
        'Where the supply is legally digital content not on a tangible medium, a change-of-mind cancellation right can end only when supply begins after the required prior express consent, acknowledgement and contract confirmation. Where it is a service, requested early performance may lead to a proportionate charge if you cancel; the right is lost after full performance only where the required legal conditions are met. This does not remove rights for faults or misleading descriptions.',
      ),
      section(
        'Before supply, unused or uninstalled plans',
        'Contact us promptly before provisioning, installation or use. We will check the order state and any applicable cancellation right. An unused/uninstalled plan may be cancellable, but it is not safe to assume its validity has not already started: some products start on purchase. We will explain the basis for any lawful restriction or proportionate charge rather than automatically refusing.',
      ),
      section(
        'Installed or activated plans',
        'We will assess the activation trigger, actual supply/use, your recorded request/acknowledgement and applicable law. Installation or activation is relevant evidence, not proof that every refund right has ended. Please avoid deleting the eSIM during an investigation; it may prevent repair or reinstallation.',
      ),
      section(
        'Wrong device, destination or plan',
        'Check the exact device/carrier-unlock status and itinerary before purchase. If you chose incorrectly, contact us before installation/use; we will assess cancellation and any available resolution. Where we supplied the wrong product or materially incorrect compatibility/coverage information, we remain responsible for the appropriate remedy. A compatibility checkbox is not a waiver of those rights.',
      ),
      section(
        'Missing email or QR delivery',
        'Check spam and your private order/account page, then contact us. We will verify ownership before re-sending confidential installation data. A failed email is not automatically proof of successful supply, nor is a payment confirmation proof of profile allocation. We will investigate incorrect addresses, delays and provisioning failures.',
      ),
      section(
        'Faults, unusable service and coverage',
        'Report the device, destination, approximate time and non-sensitive error information. We may guide reasonable troubleshooting and liaise with the supplier/operator. Depending on the applicable rules and circumstances, remedies can include re-performance, repair/replacement, a price reduction or refund. Indicative network speeds/coverage are not guarantees, but we cannot use that wording to excuse a misleading description or exclude mandatory remedies.',
      ),
      section(
        'Duplicate, failed or unauthorised payments',
        'A failed payment should not produce an eSIM. If you suspect a duplicate order/charge, contact us so we can distinguish a pending authorisation from a captured payment and correct an actual duplicate. Report unauthorised use promptly to us and your payment provider; proportionate verification may be necessary. Fraud investigations do not automatically remove the rights of an innocent customer.',
      ),
      section(
        'Expiry and unused allowance',
        'Expiry under correctly disclosed plan terms does not itself create a promise to refund unused data or extend the plan. We still assess faulty/misdescribed supply, an incorrect activation trigger, delivery failure and any applicable statutory rights. We do not invent a universal supplier installation deadline, top-up entitlement or cancellation window.',
      ),
      section(
        'Refund processing',
        'Where a refund is due, we use the original payment method unless otherwise lawfully agreed, without a refund fee imposed for exercising a statutory right. We meet the applicable legal refund deadline (commonly 14 days for relevant statutory cancellations/remedies); bank/provider posting can take additional time. We will confirm the amount/currency and status. Supplier allocation failures can enter the backend refund process, but a pending refund is not yet a completed refund.',
      ),
      section(
        'Model cancellation notice',
        `To: Rewolo Technologies Ltd trading as Alozuri, ${BUSINESS.address}; ${BUSINESS.email}. I give notice that I cancel my contract for the following eSIM order: [order reference/product]. Ordered on: [date]. Consumer name and contact address/email: [details]. Date: [date]. Signature is needed only if sending a paper notice. You may instead send any other clear cancellation statement.`,
      ),
      section(
        'Complaints',
        `If you disagree with a decision, ask ${BUSINESS.email} to review it and explain the relevant facts and legal basis. Your payment-provider dispute rights and rights to complain to an appropriate authority or court are not removed by this process.`,
      ),
    ],
  },
  compatibility: {
    slug: 'compatibility',
    path: '/esim-compatibility',
    title: 'eSIM Compatibility and Installation',
    description:
      'Check eSIM support, carrier unlocking, installation, activation timing and safe troubleshooting before buying travel data.',
    sections: [
      section(
        'Check the exact device',
        'Confirm eSIM support for the exact model, region of manufacture/purchase, operating-system version and carrier. Manufacturer variants can differ. Check your manufacturer/carrier documentation and cellular settings for eSIM options; no unverified universal model list is presented as a guarantee.',
      ),
      section(
        'Carrier unlocking',
        'A carrier-locked device may reject a travel eSIM even if it supports eSIM technology. On iPhone check Settings → General → About → Carrier Lock; menus/labels vary. On Android check manufacturer/carrier instructions. Ask the carrier if uncertain; Alozuri cannot remotely unlock your home carrier’s device.',
      ),
      section(
        'Before paying',
        'Check all included countries, high-speed allowance, fair-use policy, validity and the exact activation trigger. Buy only when ready if the product starts on purchase. Keep an alternative connection/means of emergency contact. A data-only eSIM does not replace every service on your home SIM.',
      ),
      section(
        'Installation',
        'Connect to reliable Wi-Fi or another working internet connection. Open your private order/account page and follow its QR/manual installation instructions. Typical paths include iPhone Settings → Cellular/Mobile Service → Add eSIM, or Android Settings → Connections/Network & internet → SIM manager/SIMs. Do not expose the QR code or activation string to public screen sharing or chat.',
      ),
      section(
        'At the destination',
        'Select the travel eSIM for mobile data and follow the supplied roaming/APN instructions. Turn off data roaming/automatic data switching on your home SIM if you do not want its carrier charges. Enter an APN only when the order/supplier provides it; do not invent network or APN settings.',
      ),
      section(
        'Activation and reinstallation',
        'Depending on the product, validity starts on purchase, installation or first supported network connection. Installing early can start some plans immediately. Deleting/transferring a profile can make it unusable and reinstallation is not universally supported; contact us before deleting it. Exact installation limits and unused-profile expiry need product-specific confirmation.',
      ),
      section(
        'Troubleshooting and accessibility',
        `Check coverage, active line selection, remaining validity and any daily limit; try airplane mode/restart where appropriate. Your device or local network can limit hotspot, 4G/5G or app access. Contact ${BUSINESS.email} with the order reference and non-sensitive diagnostics if you need help or an accessible alternative to the displayed instructions. Do not send full payment details or activation credentials.`,
      ),
    ],
  },
  'acceptable-use': {
    slug: 'acceptable-use',
    path: '/acceptable-use',
    title: 'Acceptable Use, Fair Usage and Network Coverage',
    description:
      'Permitted eSIM use, fair-use limits, unlimited-plan conditions and the limits of local network coverage.',
    sections: [
      section(
        'Lawful use',
        'Use your eSIM lawfully in each destination and comply with disclosed supplier/network conditions. Do not use stolen credentials, commit fraud, harass others, distribute unlawful material, attack networks or bypass access controls. Do not impersonate Alozuri or resell a profile/service unless expressly permitted.',
      ),
      section(
        'Allowances and unlimited claims',
        'A fixed plan has a total allowance. A daily cutoff plan stops at its daily limit. A daily reduced-speed plan continues under its disclosed fair-use policy after its high-speed amount. Expressly unlimited products may have speed/other restrictions. Unlimited is not a promise of unrestricted full-speed data, and unknown conditions are not presented as verified features.',
      ),
      section(
        'Network coverage and roaming',
        'Connectivity depends on local operators, roaming partners, device compatibility, congestion, local law and infrastructure. Maps/speeds are indicative where supplied; a country list is not a guarantee of signal everywhere or access to every operator. We remain responsible for accurate descriptions and mandatory consumer remedies.',
      ),
      section(
        'Special uses',
        'Do not assume support for tethering, routers, VPNs, VoIP, emergency calling, SMS, a local phone number or restricted apps. Check the plan and local requirements before relying on a specific use. High-volume/automated use that violates disclosed limits or harms networks may be restricted proportionately.',
      ),
      section(
        'Enforcement and complaints',
        `Where a reasonable security/legal/contract ground exists, we or the relevant provider may limit unlawful or harmful use. We will consider proportionality, explain where lawful and preserve applicable refund/complaint rights. Contact ${BUSINESS.email} to report abuse or challenge an incorrect restriction; no general licence to confiscate prepaid service or exclude statutory rights is created by this policy.`,
      ),
    ],
  },
  contact: {
    slug: 'contact',
    path: '/contact',
    title: 'Contact, Support and Complaints',
    description:
      'Contact Alozuri customer support, report an eSIM problem, request a refund or exercise your privacy rights.',
    sections: [
      section(
        'Email support',
        `Email ${BUSINESS.email} for purchase, installation, refund, complaint and privacy requests. Include your order reference where relevant, device model, destination and a short non-sensitive description. We do not publish a telephone number or promise 24/7 staffing or an instant response.`,
      ),
      section(
        'Optional live chat',
        'Tawk.to chat is optional and opens in a compact panel on desktop or full screen on mobile only when you choose it. Availability depends on the provider and agents; if unavailable, use email. The provider runs in an isolated frame and we do not automatically attach your customer profile. Never post a QR code, activation string, password or full card information.',
      ),
      section(
        'Refunds and formal complaints',
        'Tell us clearly if you wish to cancel or request a remedy. See the Refund and Cancellation Policy for a model notice. For a complaint, explain what happened and the resolution you seek; we will investigate and explain our response. No ADR membership, support response-time guarantee or certification is claimed. Applicable statutory escalation/court rights remain available.',
      ),
      section(
        'Privacy requests',
        `For access, correction, deletion or another privacy right, contact ${BUSINESS.email}; proportionate identity checks may be needed. Requests are handled within applicable legal deadlines. Cookie settings can withdraw future optional support permission without an email request. An earlier conversation held by a provider is not automatically erased by that switch.`,
      ),
      section(
        'Registered office',
        BUSINESS.identity,
        `Registered office: ${BUSINESS.address}. This is the company’s registered address; no walk-in retail/support service is promised. Website: ${BUSINESS.site}.`,
      ),
    ],
  },
};
export const POLICY_VERSIONS: Record<string, Record<string, Policy>> = {
  '2026-11-11.1': POLICIES_V1,
  [LEGAL_VERSION]: POLICIES,
};
export function policyText(policy: Policy, version: string = LEGAL_VERSION): string {
  return (
    `${policy.title}\nVersion ${version} — effective ${LEGAL_EFFECTIVE_DATE}\n${BUSINESS.identity}\n${BUSINESS.address}\n${BUSINESS.email}\n\n` +
    policy.sections.map((s, i) => `${i + 1}. ${s.title}\n${s.paragraphs.join('\n\n')}`).join('\n\n')
  );
}
