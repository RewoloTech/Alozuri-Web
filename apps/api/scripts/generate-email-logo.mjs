// Keep the existing brand pixels unchanged. The white gutters belong to the PNG,
// so email clients need no CSS padding/background support to display them.
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const original = PNG.sync.read(
  readFileSync(new URL('../../web/public/images/alozuri-email-logo.png', import.meta.url)),
);
const left = 36,
  top = 15;
const output = new PNG({ width: original.width + left * 2, height: original.height + top * 2 });
output.data.fill(255);
for (let y = 0; y < original.height; y++) {
  original.data.copy(
    output.data,
    ((y + top) * output.width + left) * 4,
    y * original.width * 4,
    (y + 1) * original.width * 4,
  );
}
writeFileSync(
  new URL('../../web/public/images/alozuri-email-logo-padded-v2.png', import.meta.url),
  PNG.sync.write(output),
);
