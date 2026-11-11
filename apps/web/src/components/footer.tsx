import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BUSINESS } from '@voyaspan/shared/legal';
import { POLICIES } from '@voyaspan/shared/policies';
import { CookieSettingsButton } from './privacy-provider';
import { Brand } from './header';
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <Brand />
          <p>
            A little less roaming.
            <br />A lot more exploring.
          </p>
        </div>
        <nav className="footer-links" aria-labelledby="footer-explore">
          <h2 className="eyebrow" id="footer-explore">
            Explore
          </h2>
          <Link href="/destinations">
            All destinations <ArrowUpRight size={14} />
          </Link>
          <Link href="/#planner">Build your itinerary</Link>
        </nav>
        <nav className="footer-links" aria-labelledby="footer-legal">
          <h2 className="eyebrow" id="footer-legal">
            Legal
          </h2>
          {['terms', 'privacy', 'cookies', 'refunds', 'acceptable-use'].map((slug) => (
            <Link key={slug} href={POLICIES[slug].path}>
              {POLICIES[slug].title}
            </Link>
          ))}
          <CookieSettingsButton />
        </nav>
        <nav className="footer-links" aria-labelledby="footer-help">
          <h2 className="eyebrow" id="footer-help">
            Help &amp; Support
          </h2>
          <Link href="/help">Help centre</Link>
          <Link href={POLICIES.compatibility.path}>eSIM compatibility &amp; installation</Link>
          <Link href={POLICIES.contact.path}>Contact &amp; complaints</Link>
          <Link href="/account/esims">My eSIMs</Link>
          <Link href="/register">Create an account</Link>
        </nav>
      </div>
      <div className="container company-disclosure">
        <p>{BUSINESS.identity}</p>
        <address>Registered office: {BUSINESS.address}</address>
        <a href={'mailto:' + BUSINESS.email}>{BUSINESS.email}</a>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Alozuri. Made for the journey.</span>
      </div>
    </footer>
  );
}
