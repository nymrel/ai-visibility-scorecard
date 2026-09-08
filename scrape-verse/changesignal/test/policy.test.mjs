import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicHttpsUrl } from '../src/policy.mjs';

test('accepts a public HTTPS changelog', () => {
  assert.equal(assertPublicHttpsUrl('https://example.com/changelog').href, 'https://example.com/changelog');
});

for (const value of [
  'http://example.com/changelog',
  'https://localhost/changelog',
  'https://127.0.0.1/changelog',
  'https://10.0.0.4/changelog',
  'https://169.254.1.1/changelog',
  'https://example.gov/changelog',
  'https://example.com/login',
  'https://user:pass@example.com/changelog',
]) {
  test(`blocks disallowed target: ${value}`, () => {
    assert.throws(() => assertPublicHttpsUrl(value));
  });
}
