import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLogo } from '../utils/logoFile.js';

test('logo importer rejects HTML/SVG/empty/oversized inputs', () => {
  for (const bytes of [Buffer.from('<html>Not a logo</html>'), Buffer.from('<svg/>'), Buffer.alloc(0), Buffer.alloc(5*1024*1024+1)]) {
    assert.throws(() => inspectLogo(bytes));
  }
});
test('logo importer detects format from bytes and uses deterministic content hashes', () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  const info = inspectLogo(png);
  assert.equal(info.extension, 'png');
  assert.equal(info.contentType, 'image/png');
  assert.equal(info.hash.length, 64);
  assert.equal(info.hash, inspectLogo(png).hash);
});
