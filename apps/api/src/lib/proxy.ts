import { isIP } from 'node:net';
// Cloud Run always terminates inbound requests at its managed proxy. Trust only
// the immediate private socket peer, never an arbitrary user-supplied header chain.
export function platformProxyTrust(enabled: boolean) {
  return (address: string, hop: number): boolean => {
    if (!enabled || hop !== 0) return false;
    const ip = address.replace(/^::ffff:/, '');
    if (ip === '::1') return true;
    if (isIP(ip) !== 4) return false;
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  };
}
