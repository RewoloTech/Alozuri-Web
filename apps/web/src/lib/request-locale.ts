import { headers } from 'next/headers';
import { isLocale } from '@alozuri/shared/i18n';
export async function requestLocale() {
  const value = (await headers()).get('x-alozuri-locale');
  return isLocale(value) ? value : 'en';
}
