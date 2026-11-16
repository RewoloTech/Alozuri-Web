'use client';
import { useTranslations } from 'next-intl';
import { useLanguage } from './language-provider';

export function LegalLanguageNotice() {
  const t = useTranslations('checkout');
  const { changeLanguage } = useLanguage();
  return <section className="container section policy-page">
    <p className="notice" role="status">{t('legalUnavailable')}</p>
    <button type="button" className="button primary" onClick={() => void changeLanguage('en')}>{t('useEnglish')}</button>
  </section>;
}
