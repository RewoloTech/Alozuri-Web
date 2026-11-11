import { notFound, permanentRedirect } from 'next/navigation';
import { POLICIES } from '@voyaspan/shared/policies';
export const metadata = { robots: { index: false, follow: true } };
export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!Object.hasOwn(POLICIES, slug)) notFound();
  permanentRedirect(POLICIES[slug].path);
}
export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}
