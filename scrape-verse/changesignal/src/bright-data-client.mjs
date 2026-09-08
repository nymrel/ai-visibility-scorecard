import { assertPublicHttpsUrl } from './policy.mjs';

const DEFAULT_API_BASE = 'https://api.brightdata.com';

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readResponseBody(response) {
  const contentType = response.headers?.get?.('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseError(response, body) {
  const detail = typeof body === 'string' ? body : JSON.stringify(body);
  return new Error(`Bright Data API request failed (${response.status} ${response.statusText || 'unknown'}): ${detail}`);
}

export class BrightDataClient {
  constructor({
    token,
    collectorId,
    fetchImpl = globalThis.fetch,
    apiBase = DEFAULT_API_BASE,
    pollIntervalMs = 2_000,
    maxPollAttempts = 45,
  } = {}) {
    if (!token) throw new Error('Bright Data API token is required');
    if (!collectorId) throw new Error('Bright Data collector ID is required');
    if (typeof fetchImpl !== 'function') throw new Error('a fetch implementation is required');
    if (!Number.isInteger(maxPollAttempts) || maxPollAttempts < 1) throw new Error('maxPollAttempts must be a positive integer');

    this.token = token;
    this.collectorId = collectorId;
    this.fetchImpl = fetchImpl;
    const endpoint = new URL(apiBase);
    if (endpoint.href !== `${DEFAULT_API_BASE}/`) throw new Error('only the official Bright Data API origin is supported');
    this.apiBase = DEFAULT_API_BASE;
    this.pollIntervalMs = Math.max(0, Number(pollIntervalMs) || 0);
    this.maxPollAttempts = maxPollAttempts;
  }

  headers() {
    return {
      authorization: `Bearer ${this.token}`,
      'content-type': 'application/json',
    };
  }

  async trigger(targetUrl, extraInput = {}) {
    const safeUrl = assertPublicHttpsUrl(targetUrl);
    if (!extraInput || typeof extraInput !== 'object' || Array.isArray(extraInput)
      || Object.keys(extraInput).some((key) => key !== 'source_name')
      || (extraInput.source_name !== undefined && typeof extraInput.source_name !== 'string')) {
      throw new Error('extra input may contain only source_name');
    }
    const endpoint = new URL('/dca/trigger', this.apiBase);
    endpoint.searchParams.set('collector', this.collectorId);
    endpoint.searchParams.set('queue_next', '1');

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: this.headers(),
      body: JSON.stringify({ ...extraInput, url: safeUrl.href }),
    });
    const body = await readResponseBody(response);
    if (!response.ok) throw responseError(response, body);

    const collectionId = body?.collection_id ?? body?.snapshot_id ?? body?.id;
    if (!collectionId || typeof collectionId !== 'string') {
      throw new Error('Bright Data trigger response did not include a collection_id');
    }
    return collectionId;
  }

  async readDataset(snapshotId) {
    if (!snapshotId) throw new Error('snapshot ID is required');

    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt += 1) {
      const endpoint = new URL('/dca/dataset', this.apiBase);
      endpoint.searchParams.set('id', snapshotId);
      const response = await this.fetchImpl(endpoint, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: { authorization: `Bearer ${this.token}` },
      });
      const body = await readResponseBody(response);

      if (response.ok && Array.isArray(body)) return body;
      if (response.ok && Array.isArray(body?.data)) return body.data;

      const pending = response.status === 202 || ['building', 'collecting', 'pending', 'queued', 'running'].includes(String(body?.status ?? '').toLowerCase());
      if (!pending) throw responseError(response, body);
      if (attempt < this.maxPollAttempts) await sleep(this.pollIntervalMs);
    }

    throw new Error(`Bright Data dataset was not ready after ${this.maxPollAttempts} polling attempts`);
  }

  async collect(targetUrl, extraInput = {}) {
    const collectionId = await this.trigger(targetUrl, extraInput);
    const rows = await this.readDataset(collectionId);
    return { collectionId, rows };
  }

  async refactorTemplate({ prompt, customInput = {} } = {}) {
    if (!prompt || typeof prompt !== 'string') throw new Error('a non-empty repair prompt is required');
    if (!customInput || typeof customInput !== 'object' || Array.isArray(customInput)
      || Object.keys(customInput).some((key) => key !== 'url')) throw new Error('repair input must contain only the target URL');
    const safeUrl = assertPublicHttpsUrl(customInput.url);
    const endpoint = new URL(`/dca/collectors/${encodeURIComponent(this.collectorId)}/refactor_template`, this.apiBase);
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: this.headers(),
      body: JSON.stringify({ prompt, custom_input: { url: safeUrl.href } }),
    });
    const body = await readResponseBody(response);
    if (!response.ok) throw responseError(response, body);
    return body;
  }
}
