import { NextResponse, type NextRequest } from 'next/server';
import {
  isLocale,
  isPublishedLocale,
  internalLocalePath,
  privateLocalePath,
  LOCALE_COOKIE,
  LOCALE_EXPLICIT_COOKIE,
} from '@alozuri/shared/i18n';
/** Public locale aliases reuse existing routes; API and service paths stay unchanged. */
export function proxy(request: NextRequest) {
  const first = request.nextUrl.pathname.split('/')[1];
  const prefixed = isLocale(first);
  const path = prefixed
    ? request.nextUrl.pathname.slice(first.length + 1) || '/'
    : request.nextUrl.pathname;
  if (prefixed && internalLocalePath(path))
    return new NextResponse('Unknown page.', {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' },
    });
  const locale = prefixed ? first : 'en';
  const privatePage = privateLocalePath(path);
  const headers = new Headers(request.headers);
  headers.set('x-alozuri-locale', locale);
  headers.set('x-alozuri-locale-explicit', prefixed ? '1' : '0');
  const url = request.nextUrl.clone();
  url.pathname = path;
  if (locale === 'en' && prefixed) {
    const response = NextResponse.redirect(url, 308);
    const options = {
      path: '/',
      sameSite: 'lax' as const,
      secure: request.nextUrl.protocol === 'https:',
      maxAge: 15552000,
    };
    response.cookies.set(LOCALE_COOKIE, 'en', options);
    response.cookies.set(LOCALE_EXPLICIT_COOKIE, '1', options);
    if (privatePage) response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const response = prefixed
    ? NextResponse.rewrite(url, { request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.headers.set('Content-Language', locale === 'en' ? 'en-GB' : locale);
  if (privatePage || !isPublishedLocale(locale)) {
    response.headers.set(
      'X-Robots-Tag',
      privatePage ? 'noindex, nofollow, noarchive' : 'noindex, follow',
    );
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
