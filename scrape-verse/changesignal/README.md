# Nymrel ChangeSignal

A small, auditable public-changelog radar for **Bright Data Into the Scrape-Verse**. A custom Bright Data Scraper Studio collector gathers structured public release notes; this Node.js layer validates target policy, triggers the collector, polls its dataset, normalizes records, compares them with a baseline, and emits JSON plus a human-readable change report.

The repository branch starts with a credential-free scaffold. The demo and tests are real; a live Bright Data collector run is still an explicit operator/Nymrel gate.

## Why this is useful beyond the event

Nymrel monitors fast-moving AI providers and developer platforms. ChangeSignal turns public changelog pages into stable records that agents can diff, cite, route, and review without pretending a website is an API. The core stays provider-light: Bright Data handles collection and selector maintenance; this package handles policy, provenance, normalization, and evidence.

## Safety boundary

ChangeSignal screens submitted HTTPS URL syntax: it rejects IP literals, local hostname suffixes, nonstandard ports, embedded credentials, government domains, and obvious login/account/paywall paths. This is not DNS resolution, DNS pinning, or enforcement of a remote collector's redirects or subresources. Only operator-reviewed public hostnames and collectors belong on the live path; the collector must enforce its own target and network scope. The API client pins the official API origin, refuses redirects, and bounds each request to 30 seconds. It must not be used to bypass authentication, collect personal data, or scrape restricted sources.

## Run the deterministic demo

```bash
npm test
npm run demo
```

The demo uses `fixtures/sample-collector-output.json`, performs no network calls, and writes:

- `artifacts/demo/latest.json`
- `artifacts/demo/diff.json`
- `artifacts/demo/report.md`

## Run with a real Bright Data collector

1. Create a **custom** Scraper Studio collector using `collector-prompt.md`.
2. Store the API token outside GitHub.
3. Review the target as public, non-government, non-login, non-paywalled, and permitted for collection.
4. Set the environment variables from `.env.example`.
5. Run:

```bash
npm run run
```

The client triggers the collector, stores the returned collection ID in the report, polls the dataset until structured rows are ready, then emits normalized artifacts.

## Optional repair path

When a real collector breaks because the public page changed, set `HEAL_PROMPT` and run:

```bash
npm run heal
```

That calls the collector-template refactor endpoint. It is not an autonomous permission to alter targets or broaden data collection; review the repaired collector before another live run.

## Architecture

```text
approved public URL
        │
        ▼
public-target policy ──deny──> blocked receipt/error
        │ allow
        ▼
Bright Data custom collector trigger
        │ collection_id
        ▼
Bright Data dataset polling
        │ JSON rows
        ▼
normalization + deduplication
        │
        ▼
baseline diff ──> latest.json / diff.json / report.md
```

## Event readiness

See `SUBMISSION_CHECKLIST.md`. Registration, rules acceptance, account/token creation, live collection, public release, video, and final submission remain separate actions. Fixture output must never be represented as a live Bright Data result.

## License

This event subproject inherits the repository’s MIT license unless the repository owner records a different approved separation before release.
