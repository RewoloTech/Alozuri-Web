import type { Messages as AlozuriMessages } from '@alozuri/shared/i18n/messages';
import type { Locale as AlozuriLocale } from '@alozuri/shared/i18n';
declare module 'next-intl' {
  interface AppConfig {
    Locale: AlozuriLocale;
    Messages: AlozuriMessages;
  }
}
