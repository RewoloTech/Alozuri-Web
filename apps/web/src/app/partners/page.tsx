import { ArrowUpRight, ChartNoAxesCombined, ChevronDown, Clock3, Percent } from 'lucide-react';
import { localizedMetadata as publicMetadata } from '@/lib/localized-metadata';
import styles from './partners.module.css';

const applicationUrl = 'https://alozuricom-1c30.endorsely.com';
export async function generateMetadata() {
  return {
    ...(await publicMetadata(
      'Alozuri Affiliate Programme | Become a Partner',
      'Join the Alozuri Affiliate Programme. Earn 10% commission on qualifying eSIM referrals with 30-day tracking and a dedicated partner dashboard.',
      '/partners',
    )),
    title: { absolute: 'Alozuri Affiliate Programme | Become a Partner' },
  };
}
const benefits = [
  {
    icon: Percent,
    title: '10% Commission',
    text: 'Earn 10% on every qualifying eSIM purchase attributed to your referral.',
  },
  {
    icon: Clock3,
    title: '30-Day Tracking',
    text: 'Receive credit for eligible purchases completed within 30 days of a referral.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Dedicated Dashboard',
    text: 'Access your affiliate dashboard to monitor referrals, sales and commissions.',
  },
];
const steps = [
  ['Apply', 'Submit your application to join the Alozuri Affiliate Programme.'],
  [
    'Share',
    'Once approved, receive your unique referral link and promote Alozuri through your channels.',
  ],
  [
    'Earn',
    'Earn commission on qualifying purchases and track your performance through the affiliate dashboard.',
  ],
];
const questions = [
  ['Is it free to join?', 'Yes. There is no fee to apply or participate.'],
  [
    'Who can become a partner?',
    'Travel creators, bloggers, publishers and relevant businesses can apply. All applications are subject to approval.',
  ],
  [
    'How much can I earn?',
    'Affiliates earn 10% commission on eligible purchases attributed to their referrals.',
  ],
  [
    'How are referrals tracked?',
    'Referrals are tracked for up to 30 days, subject to applicable consent and tracking availability.',
  ],
  [
    'When will I be paid?',
    'Approved commissions are paid monthly when your payable balance reaches $50 USD equivalent.',
  ],
  [
    'Where can I see my earnings?',
    'Approved partners can access their Endorsely affiliate dashboard.',
  ],
];
function ApplicationLink({ children }: { children: React.ReactNode }) {
  return (
    <a className="button primary" href={applicationUrl} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
      <span className={styles.visuallyHidden}> (opens in a new tab)</span>
    </a>
  );
}
export default function PartnersPage() {
  return (
    <div className={styles.page}>
      <section className={`container ${styles.hero}`} aria-labelledby="partners-title">
        <span className="eyebrow">ALOZURI PARTNERS</span>
        <h1 id="partners-title">Partner with Alozuri</h1>
        <p>
          Help travellers stay connected around the world and earn commission by recommending
          Alozuri eSIM plans.
        </p>
        <ApplicationLink>Become a Partner</ApplicationLink>
        <small>Free to join. Applications are subject to approval.</small>
      </section>
      <section className={`container ${styles.section}`} aria-labelledby="benefits-title">
        <h2 id="benefits-title">A rewarding partnership.</h2>
        <div className={styles.grid}>
          {benefits.map(({ icon: Icon, title, text }) => (
            <article className={styles.card} key={title}>
              <Icon className={styles.icon} size={24} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.band} aria-labelledby="steps-title">
        <div className={`container ${styles.section}`}>
          <h2 id="steps-title">How it works</h2>
          <ol className={`${styles.grid} ${styles.steps}`}>
            {steps.map(([title, text], index) => (
              <li key={title}>
                <span className={styles.number} aria-hidden="true">
                  0{index + 1}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section
        className={`container ${styles.section} ${styles.split}`}
        aria-labelledby="audience-title"
      >
        <div>
          <h2 id="audience-title">Who can partner with us?</h2>
          <p>
            Whether you create travel content or help people plan their journeys, Alozuri offers a
            straightforward way to earn by recommending international eSIM data plans.
          </p>
        </div>
        <ul className={styles.audience}>
          {[
            'Travel YouTubers',
            'Content creators and influencers',
            'Travel bloggers and publishers',
            'Travel agencies',
            'Travel communities',
          ].map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </section>
      <section className={styles.band} aria-labelledby="payments-title">
        <div className={`container ${styles.section} ${styles.split}`}>
          <div>
            <span className="eyebrow">CLEAR FROM THE START</span>
            <h2 id="payments-title">Commissions and payments</h2>
            <p>A straightforward programme, with clear qualifying criteria.</p>
          </div>
          <ul className={styles.terms}>
            <li>10% commission on qualifying purchases.</li>
            <li>30-day referral tracking window.</li>
            <li>Last-click attribution.</li>
            <li>Commissions remain pending for 30 days after purchase.</li>
            <li>Minimum payout balance: $50 USD equivalent.</li>
            <li>Approved commissions are paid monthly through supported payout methods.</li>
            <li>Refunded, cancelled, fraudulent or chargeback transactions do not qualify.</li>
          </ul>
        </div>
      </section>
      <section
        className={`container ${styles.section} ${styles.split}`}
        aria-labelledby="faq-title"
      >
        <div>
          <h2 id="faq-title">Frequently asked questions</h2>
          <p>A few things to know before you apply.</p>
        </div>
        <div className="faq-list">
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={`container ${styles.final}`} aria-labelledby="join-title">
        <h2 id="join-title">Let’s grow together.</h2>
        <p>
          Join the Alozuri Affiliate Programme and start earning by helping travellers stay
          connected.
        </p>
        <ApplicationLink>Apply to Become a Partner</ApplicationLink>
      </section>
    </div>
  );
}
