import { redirect } from 'next/navigation';
export const metadata = { title: 'Operations', robots: { index: false, follow: false } };
export default function Page() {
  redirect('/operations');
}
