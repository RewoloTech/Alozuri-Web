import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
export const metadata = publicMetadata(
  'Help and eSIM installation',
  'Get help checking device compatibility, installing your travel eSIM, understanding activation and contacting Alozuri.',
  '/help',
);
export default function Help() {
  return (
    <section className="container section help-page">
      <div className="page-intro">
        <span className="eyebrow">A LITTLE HELP FOR THE JOURNEY</span>
        <h1>Let’s get you connected.</h1>
        <p>Check your device, understand your plan and install with confidence.</p>
      </div>
      <div className="surface" id="compatibility">
        <h2>Is my phone compatible?</h2>
        <p>
          Your device must support eSIM and be carrier unlocked. Look for “Add eSIM” in cellular
          settings. Compatibility depends on the exact model and country of purchase; confirm with
          your manufacturer or carrier before buying.
        </p>
        <p>
          On iPhone, look under Settings → General → About for carrier lock information. On Android,
          check with your carrier if unlock status is unclear.
        </p>
      </div>
      <div className="steps-grid">
        <div className="surface">
          <h2>1. Before installation</h2>
          <p>
            Connect to reliable Wi-Fi. Open your order from your account. Read when validity starts:
            purchase, installation or first supported network connection, according to the plan.
          </p>
        </div>
        <div className="surface">
          <h2>2. Add your eSIM</h2>
          <p>
            iPhone: Settings → Cellular / Mobile Service → Add eSIM. Android: Settings → Connections
            / Network & internet → SIM manager / SIMs → Add eSIM. Menus vary by device.
          </p>
          <p>
            Use the QR code or manual activation details provided with your order. Never share your
            activation code.
          </p>
        </div>
        <div className="surface">
          <h2>3. At your destination</h2>
          <p>
            Select your travel eSIM for mobile data and follow its roaming instructions. Turn off
            data roaming and automatic data switching for your home SIM to avoid carrier charges.
          </p>
        </div>
      </div>
      <div className="surface">
        <h2>Connection not working?</h2>
        <p>
          Check your plan covers the country, your eSIM is selected for data, and its activation and
          roaming instructions have been followed. Try airplane mode briefly. Only enter an APN if
          your order supplies one. Avoid deleting an installed eSIM; reinstalling may not be
          supported.
        </p>
        <p>
          Live usage reporting is not provided by this storefront; do not assume an unverified
          balance or update interval.
        </p>
      </div>
      <div className="notice">
        <strong>Need more help?</strong> Email info@alozuri.com or visit our contact page.{' '}
        <Link className="text-link" href="/contact">
          Contact support →
        </Link>
      </div>
    </section>
  );
}
