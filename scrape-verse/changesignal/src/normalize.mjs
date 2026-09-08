import crypto from 'node:crypto';

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return null;
}

function cleanText(value) {
  return value === null || value === undefined
    ? null
    : String(value).replace(/\s+/g, ' ').trim() || null;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? cleanText(value) : date.toISOString();
}

function normalizeUrl(value, fallbackSourceUrl) {
  const candidate = cleanText(value);
  if (!candidate) return fallbackSourceUrl ?? null;
  try {
    return new URL(candidate, fallbackSourceUrl ?? undefined).href;
  } catch {
    return fallbackSourceUrl ?? null;
  }
}

function stableId(record) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([
      record.source_name ?? '',
      record.url ?? '',
      record.title ?? '',
      record.published_at ?? '',
    ]))
    .digest('hex')
    .slice(0, 20);
}

export function normalizeRows(rows, { sourceName = null, sourceUrl = null, collectedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(rows)) throw new Error('collector output must be an array');

  const normalized = rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`collector row ${index} must be an object`);
    }

    const title = cleanText(firstValue(row, ['title', 'headline', 'name', 'release', 'version']));
    const url = normalizeUrl(firstValue(row, ['url', 'link', 'href', 'source_url']), sourceUrl);
    const publishedAt = normalizeDate(firstValue(row, ['published_at', 'publishedAt', 'date', 'timestamp', 'released_at']));
    const summary = cleanText(firstValue(row, ['summary', 'description', 'excerpt', 'body', 'content', 'details']));
    const resolvedSourceName = cleanText(firstValue(row, ['source_name', 'sourceName', 'site', 'publisher'])) ?? sourceName;

    if (!title && !summary) {
      throw new Error(`collector row ${index} is missing both title and summary`);
    }

    const record = {
      id: null,
      title: title ?? summary.slice(0, 120),
      url,
      published_at: publishedAt,
      summary,
      source_name: resolvedSourceName,
      collected_at: collectedAt,
      raw_index: index,
    };
    record.id = stableId(record);
    return record;
  });

  const unique = new Map();
  for (const record of normalized) {
    const key = record.url || `${record.source_name || ''}\u0000${record.title.toLowerCase()}`;
    const existing = unique.get(key);
    if (!existing || (record.published_at ?? '') > (existing.published_at ?? '')) unique.set(key, record);
  }

  return [...unique.values()].sort((a, b) => {
    const dateOrder = (b.published_at ?? '').localeCompare(a.published_at ?? '');
    return dateOrder || a.title.localeCompare(b.title);
  });
}

function comparable(record) {
  return JSON.stringify({
    title: record.title ?? null,
    url: record.url ?? null,
    published_at: record.published_at ?? null,
    summary: record.summary ?? null,
    source_name: record.source_name ?? null,
  });
}

function recordKey(record) {
  return record.url || record.id || `${record.source_name || ''}\u0000${record.title || ''}`;
}

export function diffRecords(baseline, current) {
  if (!Array.isArray(baseline) || !Array.isArray(current)) throw new Error('baseline and current records must be arrays');

  const oldByKey = new Map(baseline.map((record) => [recordKey(record), record]));
  const newByKey = new Map(current.map((record) => [recordKey(record), record]));
  const added = [];
  const changed = [];
  const removed = [];
  const unchanged = [];

  for (const [key, record] of newByKey) {
    const previous = oldByKey.get(key);
    if (!previous) added.push(record);
    else if (comparable(previous) !== comparable(record)) changed.push({ before: previous, after: record });
    else unchanged.push(record);
  }
  for (const [key, record] of oldByKey) {
    if (!newByKey.has(key)) removed.push(record);
  }

  return {
    generated_at: new Date().toISOString(),
    counts: { added: added.length, changed: changed.length, removed: removed.length, unchanged: unchanged.length },
    added,
    changed,
    removed,
    unchanged,
  };
}
