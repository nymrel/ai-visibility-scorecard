function escapeMarkdown(value) {
  return String(value ?? '').replace(/([\\`*_{}[\]<>#+.!|])/g, '\\$1');
}

function recordLine(record) {
  const title = escapeMarkdown(record.title ?? 'Untitled change');
  const date = record.published_at ? ` — ${escapeMarkdown(record.published_at.slice(0, 10))}` : '';
  const link = record.url ? `[${title}](${record.url})` : title;
  const summary = record.summary ? `\n  ${escapeMarkdown(record.summary)}` : '';
  return `- ${link}${date}${summary}`;
}

export function renderMarkdownReport(diff, { title = 'Nymrel ChangeSignal report', collectionId = null, targetUrl = null } = {}) {
  const lines = [
    `# ${escapeMarkdown(title)}`,
    '',
    `Generated: ${escapeMarkdown(diff.generated_at)}`,
  ];
  if (targetUrl) lines.push(`Target: ${targetUrl}`);
  if (collectionId) lines.push(`Bright Data collection: \`${escapeMarkdown(collectionId)}\``);
  lines.push('', `Added: **${diff.counts.added}** · Changed: **${diff.counts.changed}** · Removed: **${diff.counts.removed}** · Unchanged: **${diff.counts.unchanged}**`, '');

  const sections = [
    ['New records', diff.added],
    ['Changed records', diff.changed.map((entry) => entry.after)],
    ['Removed records', diff.removed],
  ];
  for (const [heading, records] of sections) {
    lines.push(`## ${heading}`, '');
    if (!records.length) lines.push('_None._');
    else lines.push(...records.map(recordLine));
    lines.push('');
  }

  lines.push('## Provenance', '', '- Generated from structured collector output.', '- This report does not prove that a source is accurate, current, public, or legally reusable.', '- A live competition submission must include the actual Bright Data collector, run evidence, and human review.', '');
  return lines.join('\n');
}
