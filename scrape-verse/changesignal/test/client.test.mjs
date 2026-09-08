import assert from 'node:assert/strict';
import test from 'node:test';
import { BrightDataClient } from '../src/bright-data-client.mjs';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('triggers a collector and polls until data is ready', async () => {
  const requests = [];
  const responses = [
    jsonResponse(200, { collection_id: 'collection-123' }),
    jsonResponse(202, { status: 'running' }),
    jsonResponse(200, [{ title: 'Done' }]),
  ];
  const client = new BrightDataClient({
    token: 'test-token',
    collectorId: 'collector-123',
    pollIntervalMs: 0,
    maxPollAttempts: 3,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return responses.shift();
    },
  });

  const result = await client.collect('https://example.com/changelog');
  assert.equal(result.collectionId, 'collection-123');
  assert.deepEqual(result.rows, [{ title: 'Done' }]);
  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /\/dca\/trigger\?collector=collector-123&queue_next=1/);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(JSON.parse(requests[0].options.body).url, 'https://example.com/changelog');
  assert.match(requests[1].url, /\/dca\/dataset\?id=collection-123/);
});

test('fails closed when trigger response lacks a collection ID', async () => {
  const client = new BrightDataClient({
    token: 'test-token',
    collectorId: 'collector-123',
    fetchImpl: async () => jsonResponse(200, { ok: true }),
  });
  await assert.rejects(() => client.trigger('https://example.com/changelog'), /collection_id/);
});

test('calls the collector refactor endpoint for an approved repair', async () => {
  let request;
  const client = new BrightDataClient({
    token: 'test-token',
    collectorId: 'collector/123',
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return jsonResponse(200, { status: 'accepted' });
    },
  });
  const result = await client.refactorTemplate({ prompt: 'Repair selectors', customInput: { url: 'https://example.com/changelog' } });
  assert.deepEqual(result, { status: 'accepted' });
  assert.match(request.url, /collectors\/collector%2F123\/refactor_template/);
  assert.deepEqual(JSON.parse(request.options.body), {
    prompt: 'Repair selectors',
    custom_input: { url: 'https://example.com/changelog' },
  });
});

test('blocks alternate API endpoints before credentials can leave the official origin', () => {
  for (const apiBase of ['https://evil.example', 'http://api.brightdata.com', 'https://user@api.brightdata.com', 'https://api.brightdata.com/path']) {
    assert.throws(() => new BrightDataClient({ token: 'test-token', collectorId: 'c', apiBase }));
  }
});

test('blocks URL overrides and invalid repair targets before transport', async () => {
  let calls = 0;
  const client = new BrightDataClient({ token: 'test-token', collectorId: 'c', fetchImpl: async () => { calls++; throw new Error('unexpected transport'); } });
  await assert.rejects(() => client.trigger('https://example.com/changelog', { url: 'https://localhost' }), /source_name/);
  for (const url of ['https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://127.1/', 'https://example.com/%6cogin', 'https://example.com:444/']) {
    await assert.rejects(() => client.refactorTemplate({ prompt: 'repair', customInput: { url } }));
  }
  assert.equal(calls, 0);
});

test('all API paths refuse redirects and include a request deadline', async () => {
  const requests = [];
  const client = new BrightDataClient({ token: 'test-token', collectorId: 'c', fetchImpl: async (url, options) => {
    requests.push(options);
    if (url.pathname === '/dca/dataset') return jsonResponse(200, []);
    return jsonResponse(200, { collection_id: 'c' });
  } });
  await client.trigger('https://example.com/changelog');
  await client.readDataset('c');
  await client.refactorTemplate({ prompt: 'repair', customInput: { url: 'https://example.com/changelog' } });
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.redirect, 'error');
    assert.ok(request.signal instanceof AbortSignal);
  }
});
