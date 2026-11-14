import { sendMetaPurchase } from '@/lib/meta-conversions';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return sendMetaPurchase(request);
}
