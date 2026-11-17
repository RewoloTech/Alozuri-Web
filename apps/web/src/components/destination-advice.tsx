import { LinkedMessage, MESSAGE_LINKS } from './linked-message';
import { serverTranslations } from '@/lib/server-translations';
import type { DestinationContent } from '@/lib/destination-content';
export async function DestinationAdvice({ content }: { content: DestinationContent }) {
  const { t } = await serverTranslations();
  return (
    <section className="section destination-advice">
      <h2>{t('regionUi.adviceTitle')}</h2>
      <ul>
        {content.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <h2>{t('regionUi.questions')}</h2>
      <div className="faq-list">
        {content.faq.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
      <p>
        <LinkedMessage
          message={t('regionUi.adviceLinks', {
            compatibility: MESSAGE_LINKS.compatibility,
            installation: MESSAGE_LINKS.installation,
            refunds: MESSAGE_LINKS.refunds,
          })}
          links={{
            compatibility: { href: '/esim-compatibility', label: t('regionUi.compatibility') },
            installation: {
              href: '/guides/install-esim-before-travel',
              label: t('regionUi.installation'),
            },
            refunds: { href: '/refund-policy', label: t('legal.refunds') },
          }}
        />
      </p>
    </section>
  );
}
