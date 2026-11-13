import Link from 'next/link';
import type { DestinationContent } from '@/lib/destination-content';
export function DestinationAdvice({ content }: { content: DestinationContent }) {
  return (
    <section className="section destination-advice">
      <h2>Plan your mobile data before travelling</h2>
      <ul>
        {content.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <h2>Common questions</h2>
      <div className="faq-list">
        {content.faq.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
      <p>
        Check <Link href="/esim-compatibility">device compatibility</Link>, read{' '}
        <Link href="/guides/install-esim-before-travel">when to install your eSIM</Link>, or review
        the <Link href="/refund-policy">refund and cancellation policy</Link>. Installation and
        activation can affect cancellation eligibility; the policy explains exceptions and consumer
        rights.
      </p>
    </section>
  );
}
