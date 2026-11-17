import { serverTranslations, type TranslationKey } from '@/lib/server-translations';
export async function LocalizedLoading({
  message = 'common.loading',
}: {
  message?: TranslationKey;
}) {
  const { t } = await serverTranslations();
  return (
    <div className="loading-page" role="status">
      {t(message)}
    </div>
  );
}
