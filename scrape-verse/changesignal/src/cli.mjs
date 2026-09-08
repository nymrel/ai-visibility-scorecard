#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { BrightDataClient } from './bright-data-client.mjs';
import { diffRecords, normalizeRows } from './normalize.mjs';
import { renderMarkdownReport } from './report.mjs';

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== null) return fallback;
    throw error;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function writeArtifacts({ rows, baseline, collectionId = null, targetUrl = null, sourceName = null, artifactDir }) {
  const current = normalizeRows(rows, { sourceName, sourceUrl: targetUrl });
  const diff = diffRecords(baseline, current);
  const report = renderMarkdownReport(diff, {
    title: sourceName ? `Nymrel ChangeSignal — ${sourceName}` : 'Nymrel ChangeSignal report',
    collectionId,
    targetUrl,
  });

  await mkdir(artifactDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(artifactDir, 'latest.json'), `${JSON.stringify(current, null, 2)}\n`),
    writeFile(path.join(artifactDir, 'diff.json'), `${JSON.stringify(diff, null, 2)}\n`),
    writeFile(path.join(artifactDir, 'report.md'), report),
  ]);
  return { current, diff, report };
}

async function runLive() {
  const targetUrl = required('TARGET_URL');
  const sourceName = process.env.TARGET_NAME?.trim() || new URL(targetUrl).hostname;
  const baselinePath = process.env.BASELINE_PATH || 'fixtures/baseline.json';
  const artifactDir = process.env.ARTIFACT_DIR || 'artifacts';
  const baseline = await readJson(baselinePath, []);
  const client = new BrightDataClient({
    token: required('BRIGHT_DATA_API_TOKEN'),
    collectorId: required('BRIGHT_DATA_COLLECTOR_ID'),
  });
  const { collectionId, rows } = await client.collect(targetUrl, { source_name: sourceName });
  const result = await writeArtifacts({ rows, baseline, collectionId, targetUrl, sourceName, artifactDir });
  process.stdout.write(`${result.report}\n`);
}

async function runDemo() {
  const rows = await readJson('fixtures/sample-collector-output.json');
  const baseline = await readJson('fixtures/baseline.json', []);
  const result = await writeArtifacts({
    rows,
    baseline,
    collectionId: 'demo-collection-no-network',
    targetUrl: 'https://example.com/changelog',
    sourceName: 'Example public changelog',
    artifactDir: process.env.ARTIFACT_DIR || 'artifacts/demo',
  });
  process.stdout.write(`${result.report}\n`);
}

async function heal() {
  const targetUrl = required('TARGET_URL');
  const client = new BrightDataClient({
    token: required('BRIGHT_DATA_API_TOKEN'),
    collectorId: required('BRIGHT_DATA_COLLECTOR_ID'),
  });
  const response = await client.refactorTemplate({
    prompt: required('HEAL_PROMPT'),
    customInput: { url: targetUrl },
  });
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
}

const command = process.argv[2] || 'demo';
const handlers = { demo: runDemo, run: runLive, heal };
if (!handlers[command]) {
  process.stderr.write('Usage: node src/cli.mjs <demo|run|heal>\n');
  process.exitCode = 2;
} else {
  handlers[command]().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
