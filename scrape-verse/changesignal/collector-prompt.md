# Bright Data Scraper Studio prompt

Create a **custom** scraper named **Nymrel ChangeSignal — Public Changelog Collector**.

The scraper receives this input:

```json
{
  "url": "https://example.com/changelog",
  "source_name": "Example public changelog"
}
```

Requirements:

1. Visit only the supplied public HTTPS changelog, release-notes, product-updates, or documentation-history page.
2. Do not log in, solve an authentication challenge, bypass a paywall, collect personal data, follow private/restricted links, or target any government website.
3. Extract each visible update as one structured object with exactly these preferred fields:
   - `title` — update title or release name;
   - `url` — canonical absolute URL for the update;
   - `published_at` — ISO-8601 date/time when available, otherwise null;
   - `summary` — concise visible summary, otherwise null;
   - `source_name` — copy of the input source name.
4. Return a JSON array. Do not return markdown or prose.
5. Deduplicate records by canonical URL, then title.
6. Restrict navigation to the supplied host. Do not crawl unrelated pages.
7. When selectors fail, return a structured diagnostic rather than inventing records.
8. Keep evidence fields that help debug selector drift, but do not include cookies, tokens, emails, names of private users, or hidden page state.

Expected output:

```json
[
  {
    "title": "Agent approval receipts added",
    "url": "https://example.com/changelog/approval-receipts",
    "published_at": "2026-08-21T00:00:00.000Z",
    "summary": "Every irreversible agent action now returns a durable approval receipt.",
    "source_name": "Example public changelog"
  }
]
```

After the collector is saved to production, record its collector ID in the approved secret/configuration path. Do not commit the API token or collector credentials.
