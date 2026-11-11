import assert from 'node:assert/strict';
import test from 'node:test';
import { inspirationDestinations, seasonalInspiration } from '../src/destination-inspiration.ts';

test('travel collections switch at London month boundaries, including the November winter preview', () => {
  for (const [date, season] of [
    ['2026-02-28T23:59:59Z', 'winter'],
    ['2026-03-01T00:00:00Z', 'spring'],
    ['2026-05-31T22:59:59Z', 'spring'],
    ['2026-05-31T23:00:00Z', 'summer'],
    ['2026-08-31T23:00:00Z', 'autumn'],
    ['2026-11-01T00:00:00Z', 'winter'],
    ['2027-01-01T00:00:00Z', 'winter'],
  ])
    assert.equal(seasonalInspiration(new Date(date)).season, season);
});

test('four seasonal cards keep Japan visible and restore the preferred winter selection', () => {
  assert.equal(Object.keys(inspirationDestinations).length, 12);
  for (let month = 0; month < 12; month++) {
    const selection = seasonalInspiration(new Date(Date.UTC(2026, month, 10)));
    assert.equal(selection.destinations.length, 4);
    assert.equal(new Set(selection.destinations.map((d) => d.code)).size, 4);
    assert.equal(selection.destinations[0].code, 'JP');
    assert.ok(selection.destinations.some((d) => d.code === 'TR'));
    assert.deepEqual(selection, seasonalInspiration(new Date(Date.UTC(2026, month, 20))));
  }
  const november = seasonalInspiration(new Date('2026-11-11T12:00:00Z'));
  assert.deepEqual(
    november.destinations.map((d) => d.code),
    ['JP', 'FR', 'US', 'TR'],
  );
  assert.deepEqual(
    november.destinations,
    seasonalInspiration(new Date('2026-12-11T12:00:00Z')).destinations,
  );
  assert.notDeepEqual(
    november.destinations,
    seasonalInspiration(new Date('2027-07-11T12:00:00Z')).destinations,
  );
});
