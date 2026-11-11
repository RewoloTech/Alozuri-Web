import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterDestinations,
  countries,
  countryName,
  countryFlag,
  uniqueDestinations,
  type Country,
} from '../src/index.ts';
test('destination lists remove legacy aliases and repeated codes without merging distinct countries', () => {
  const entries: Country[] = [
    { code: 'AN', name: 'Curaçao', flag: '🇦🇳', region: 'Americas' },
    { code: 'CW', name: 'Curaçao', flag: '🇨🇼', region: 'Americas' },
    { code: 'CW', name: 'Curaçao', flag: '🇨🇼', region: 'Americas' },
    { code: 'CG', name: 'Congo', flag: '🇨🇬', region: 'Africa' },
    { code: 'CD', name: 'Congo', flag: '🇨🇩', region: 'Africa' },
  ];
  const before = JSON.stringify(entries);
  const result = uniqueDestinations(entries);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result.filter((c) => c.name === 'Curaçao').map((c) => c.code),
    ['CW'],
  );
  assert.deepEqual(uniqueDestinations([...entries].reverse()), result);
  assert.equal(uniqueDestinations([entries[0]])[0].code, 'AN');
  assert.equal(JSON.stringify(entries), before);
  assert.equal(filterDestinations(result, 'Curacao').length, 1);
});
test('flags follow the displayed canonical region without replacing supplier country codes', () => {
  const supplierCode = 'AN';
  assert.equal(countryName(supplierCode), countryName('CW'));
  assert.equal(countryFlag(supplierCode), '🇨🇼');
  assert.equal(countryFlag('CW'), '🇨🇼');
  assert.equal(countryFlag('cw'), '🇨🇼');
  assert.equal(countryFlag('UK'), '🇬🇧');
  assert.equal(countryFlag('ZZ'), '🌐');
  assert.equal(countryFlag('<script>'), '🌐');
  for (const country of countries) assert.equal(countryFlag(country.code), country.flag);
});
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
