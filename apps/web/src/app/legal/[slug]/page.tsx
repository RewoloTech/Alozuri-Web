import { notFound, permanentRedirect } from 'next/navigation';
import { POLICIES } from '@alozuri/shared/policies';
import { localePath } from '@alozuri/shared/i18n';
import { requestLocale } from '@/lib/localized-metadata';
export const metadata = { robots: { index: false, follow: true } };
export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!Object.hasOwn(POLICIES, slug)) notFound();
  permanentRedirect(localePath(POLICIES[slug].path, await requestLocale()));
}
export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}
