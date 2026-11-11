import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe2,
  MapPin,
  QrCode,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi,
  Zap,
} from 'lucide-react';
import { Planner } from './planner';
import { SeasonalDestinations } from './seasonal-destinations';
import { seasonalInspiration } from '@voyaspan/shared/destination-inspiration';
export function Home({ featuredBundles }: { featuredBundles?: React.ReactNode }) {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow hero-eyebrow">
                <span className="status-dot" /> BUILT FOR THE WAY YOU TRAVEL
              </span>
              <h1>
                One eSIM.
                <br />
                <span>Every stop.</span>
              </h1>
              <p className="hero-description">
                Your whole itinerary. One simple connection.
                <br />
                Find travel data that works in every country on your list.
              </p>
              <div className="hero-benefits">
                <span>
                  <Zap size={15} />
                  Digital delivery
                </span>
                <span>
                  <Wifi size={15} />
                  No roaming surprises
                </span>
                <span>
                  <Check size={15} />
                  Keep your number
                </span>
              </div>
            </div>
            <div className="journey-card">
              <div className="journey-card-top">
                <span>
                  <Globe2 size={17} />
                  YOUR TRIP, CONNECTED
                </span>
                <span className="small-badge">ONE eSIM</span>
              </div>
              <div className="journey-stops">
                <div>
                  <span className="journey-flag">🇫🇷</span>
                  <strong>France</strong>
                  <span>Paris</span>
                </div>
                <span className="journey-line" />
                <div>
                  <span className="journey-flag">🇨🇭</span>
                  <strong>Switzerland</strong>
                  <span>Zürich</span>
                </div>
                <span className="journey-line" />
                <div>
                  <span className="journey-flag">🇮🇹</span>
                  <strong>Italy</strong>
                  <span>Rome</span>
                </div>
              </div>
              <div className="journey-confirmation">
                <ShieldCheck size={18} />
                <span>Covers all your selected countries</span>
                <Check size={17} />
              </div>
            </div>
          </div>
          <Planner initialCountries={['FR', 'CH', 'IT']} />
        </div>
      </section>
      <section className="promise-strip">
        <div className="container">
          <span>
            <Globe2 />
            One plan across borders
          </span>
          <span>
            <Smartphone />
            No physical SIM to swap
          </span>
          <span>
            <ShieldCheck />
            {process.env.NEXT_PUBLIC_DEMO_MODE === 'false' &&
            process.env.NEXT_PUBLIC_PAYMENT_MODE === 'live'
              ? 'Secure Stripe checkout'
              : 'Compare travel data plans'}
          </span>
          <span>
            <Signal />
            Data, without the detours
          </span>
        </div>
      </section>
      {featuredBundles}
      <section className="section container destinations-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR NEXT CONNECTION</span>
            <h2>Where to next?</h2>
            <p>From a weekend away to the trip you’ve been planning for years.</p>
          </div>
          <Link href="/destinations" className="text-link">
            All destinations <ArrowUpRight size={18} />
          </Link>
        </div>
        <SeasonalDestinations initial={seasonalInspiration(new Date())} />
        <div className="europe-banner">
          <span className="europe-icon">
            <MapPin size={25} />
          </span>
          <div>
            <h3>France, Switzerland and Italy? Yes, all three.</h3>
            <p>Our trip matcher checks every destination, so you don’t have to.</p>
          </div>
          <a href="#planner" className="text-link">
            Match my itinerary <ArrowRight size={18} />
          </a>
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THREE STEPS. ONE LESS THING TO THINK ABOUT.</span>
              <h2>Connected before you know it.</h2>
            </div>
            <Link href="/help#compatibility" className="text-link">
              Check your device <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="steps-grid">
            {[
              {
                n: '01',
                icon: <Globe2 />,
                title: 'Choose your destinations',
                text: 'Add every country on your itinerary. Compare plans that cover all your selected stops.',
              },
              {
                n: '02',
                icon: <QrCode />,
                title: 'Install your eSIM',
                text: 'Find your eSIM in your account once it’s ready. Scan the QR code on a stable Wi-Fi connection.',
              },
              {
                n: '03',
                icon: <Signal />,
                title: 'Land. Connect. Go.',
                text: 'Set your eSIM for mobile data and enable its data roaming. Follow the activation rules for your plan.',
              },
            ].map((s) => (
              <div className="step" key={s.n}>
                <div className="step-header">
                  <span className="step-icon">{s.icon}</span>
                  <span className="step-number">{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section container faq-section">
        <div>
          <span className="eyebrow">BEFORE YOU GO</span>
          <h2>
            A few good
            <br />
            questions.
          </h2>
          <p>
            Travel plans have enough moving parts.
            <br />
            Your connection should be simple.
          </p>
          <Link href="/help" className="text-link">
            Visit the help centre <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="faq-list">
          {[
            {
              q: 'Will one eSIM work in all my countries?',
              a: 'When a plan includes every selected country, yes. Our trip matcher only shows plans that cover your complete itinerary. Switzerland and the UK are checked individually; we don’t assume “Europe” means every European country.',
            },
            {
              q: 'Is my phone compatible?',
              a: 'Your phone must support eSIM and be unlocked. Check for “Add eSIM” in your mobile network settings, and confirm support for your exact model and purchase region with the manufacturer before buying.',
            },
            {
              q: 'Can I keep my WhatsApp and phone number?',
              a: 'Yes. Keep your existing SIM for calls and your usual WhatsApp number. Select Alozuri for mobile data, and disable data roaming on your home SIM to avoid carrier charges.',
            },
            {
              q: 'When does my plan start?',
              a: 'It depends on the package. Some plans start on installation; others start with the first supported network connection. The plan details and installation page explain the activation rule.',
            },
          ].map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <ChevronDown size={18} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="last-call">
        <div className="container">
          <div>
            <span className="eyebrow">YOUR NEXT TRIP, SIMPLIFIED</span>
            <h2>Less roaming. More going.</h2>
            <p>Your next connection starts with your destinations.</p>
          </div>
          <a href="#planner" className="button primary">
            Find my eSIM <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </>
  );
}
