import assert from 'node:assert/strict';
import test from 'node:test';
import { diffRecords, normalizeRows } from '../src/normalize.mjs';

const collectedAt = '2026-08-21T16:00:00.000Z';

test('normalizes flexible collector fields and removes duplicates', () => {
  const rows = [
    { headline: 'Release A', link: '/a', date: '2026-08-21', description: 'First' },
    { title: 'Release A', url: 'https://example.com/a', published_at: '2026-08-21', summary: 'First' },
  ];
  const result = normalizeRows(rows, {
    sourceName: 'Example',
    sourceUrl: 'https://example.com/changelog',
    collectedAt,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://example.com/a');
  assert.equal(result[0].published_at, '2026-08-21T00:00:00.000Z');
  assert.equal(result[0].source_name, 'Example');
  assert.equal(result[0].collected_at, collectedAt);
});

test('reports added, changed, removed, and unchanged records', () => {
  const baseline = [
    { id: '1', title: 'Same', url: 'https://example.com/same', summary: 'Same' },
    { id: '2', title: 'Changed', url: 'https://example.com/changed', summary: 'Old' },
    { id: '3', title: 'Removed', url: 'https://example.com/removed', summary: 'Gone' },
  ];
  const current = [
    { id: '1', title: 'Same', url: 'https://example.com/same', summary: 'Same' },
    { id: '2', title: 'Changed', url: 'https://example.com/changed', summary: 'New' },
    { id: '4', title: 'Added', url: 'https://example.com/added', summary: 'Fresh' },
  ];
  const diff = diffRecords(baseline, current);
  assert.deepEqual(diff.counts, { added: 1, changed: 1, removed: 1, unchanged: 1 });
  assert.equal(diff.changed[0].before.summary, 'Old');
  assert.equal(diff.changed[0].after.summary, 'New');
});

test('rejects collector rows without meaningful content', () => {
  assert.throws(() => normalizeRows([{}]), /missing both title and summary/);
});
