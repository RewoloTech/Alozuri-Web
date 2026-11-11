'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckoutAccount } from '@/components/checkout-account';

export default function CheckoutAccountFixture() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<{ email: string; emailVerified: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [payment, setPayment] = useState(false);
  async function authenticate(method: string, address: string) {
    setAttempts((value) => value + 1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (params.has('failure'))
      throw { code: method === 'google' ? 'auth/popup-blocked' : 'auth/invalid-credential' };
    setUser({ email: address, emailVerified: method === 'google' });
    setEmail(address);
  }
  return (
    <section className="container section commerce-layout">
      <form
        className="surface stack"
        onSubmit={(event) => {
          event.preventDefault();
          setPayment(true);
        }}
      >
        <h1>Checkout account fixture</h1>
        <CheckoutAccount
          email={email}
          onEmailChange={setEmail}
          user={user}
          onBusyChange={setBusy}
          configured={!params.has('unconfigured')}
          actions={{
            google: () => authenticate('google', 'google@example.test'),
            email: (mode, address) => authenticate(mode, address),
          }}
        />
        <button className="button primary" disabled={busy}>
          Continue to payment
        </button>
        <p>Authentication attempts: {attempts}</p>
        {payment && <p role="status">Payment continues with {email}</p>}
      </form>
    </section>
  );
}
