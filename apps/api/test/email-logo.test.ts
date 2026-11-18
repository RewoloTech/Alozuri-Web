import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

test('email logo contains opaque white gutters and preserves every original logo pixel', () => {
  const original = PNG.sync.read(
    readFileSync(new URL('../../web/public/images/alozuri-email-logo.png', import.meta.url)),
  );
  const padded = PNG.sync.read(
    readFileSync(
      new URL('../../web/public/images/alozuri-email-logo-padded-v2.png', import.meta.url),
    ),
  );
  assert.equal(padded.width, 324);
  assert.equal(padded.height, 120);
  for (let y = 0; y < padded.height; y++)
    for (let x = 0; x < padded.width; x++) {
      const pixel = padded.data.subarray(
        (y * padded.width + x) * 4,
        (y * padded.width + x + 1) * 4,
      );
      if (x >= 36 && x < 36 + original.width && y >= 15 && y < 15 + original.height) {
        const offset = ((y - 15) * original.width + (x - 36)) * 4;
        assert.deepEqual(pixel, original.data.subarray(offset, offset + 4));
      } else assert.deepEqual(pixel, Buffer.from([255, 255, 255, 255]));
    }
});
