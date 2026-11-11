import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDestinations, countries, type Country } from '../src/index.ts';
test('country lookup supports common names, ISO codes and accents without inventing unavailable destinations', () => {
  const available: Country[] = [
    ...countries,
    { code: 'CI', name: 'Côte d’Ivoire', flag: '🇨🇮', region: 'Africa' },
    { code: 'CZ', name: 'Czechia', flag: '🇨🇿', region: 'Europe' },
  ];
  for (const [q, code] of [
    ['UK', 'GB'],
    ['Britain', 'GB'],
    ['USA', 'US'],
    ['UAE', 'AE'],
    ['Turkiye', 'TR'],
    ['ivory coast', 'CI'],
    ['cote divoire', 'CI'],
    ['Czech Republic', 'CZ'],
  ])
    assert.ok(
      filterDestinations(available, q).some((c) => c.code === code),
      q,
    );
  assert.deepEqual(
    filterDestinations(
      countries.filter((c) => c.code !== 'GB'),
      'UK',
    ),
    [],
  );
  assert.deepEqual(filterDestinations(available, '<script>'), []);
  assert.equal(filterDestinations(available, '').length, available.length);
});
