import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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
          <Link href="/dashboard">My eSIMs</Link>
          <Link href="/register">Create an account</Link>
          <Link href="/help#compatibility">Device compatibility</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Alozuri. Made for the journey.</span>
        <div>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/refunds">Refunds</Link>
        </div>
      </div>
    </footer>
  );
}
