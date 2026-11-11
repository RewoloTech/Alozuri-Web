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
        <div>
          <span className="eyebrow">EXPLORE</span>
          <Link href="/destinations">
            All destinations <ArrowUpRight size={14} />
          </Link>
          <Link href="/#planner">Build your itinerary</Link>
          <Link href="/help">Help centre</Link>
        </div>
        <div>
          <span className="eyebrow">YOUR ALOZURI</span>
          <Link href="/account/esims">My eSIMs</Link>
          <Link href="/register">Create an account</Link>
          <Link href="/esim-compatibility">Device compatibility</Link>
        </div>
      </div>
      <div className="container company-disclosure">
        <p>{BUSINESS.identity}</p>
        <address>Registered office: {BUSINESS.address}</address>
        <a href={'mailto:' + BUSINESS.email}>{BUSINESS.email}</a>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Alozuri. Made for the journey.</span>
        <div>
          {Object.values(POLICIES).map((policy) => (
            <Link key={policy.slug} href={policy.path}>
              {policy.title}
            </Link>
          ))}
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  );
}
