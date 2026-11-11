'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AccountMenu } from '@/components/account-menu';

export default function AccountMenuFixture() {
  const params = useSearchParams();
  const [signedIn, setSignedIn] = useState(true),
    [attempts, setAttempts] = useState(0);
  return (
    <>
      <div className="site-header">
        <div className="container nav-wrap">
          <strong>Alozuri</strong>
          <div className="nav-actions">
            <select aria-label="Fixture currency" className="currency-select">
              <option>GBP</option>
            </select>
            {signedIn ? (
              <AccountMenu
                verified={!params.has('unverified')}
                onLogout={async () => {
                  setAttempts((value) => value + 1);
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  if (params.has('failure')) throw new Error('Controlled logout failure');
                  setSignedIn(false);
                }}
              />
            ) : (
              <p role="status">Signed out</p>
            )}
          </div>
        </div>
      </div>
      <section className="container section" style={{ paddingTop: 240 }}>
        <button type="button">Outside account navigation</button>
        <p>Logout attempts: {attempts}</p>
      </section>
    </>
  );
}
