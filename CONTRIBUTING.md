# Contributing

This repository is the reviewable source for AI Visibility Scorecard. The product must remain a truthful, deterministic self-audit rather than an invented provider metric or outcome predictor.

## Development

1. Use Node 24.20.0 and npm 11.19.1. The quality gate also runs on Node 22.12.0.
2. Run `npm ci --ignore-scripts`.
3. Install the test browser once with `npx playwright install chromium`.
4. Run `npm run check` before opening a pull request.

The product remains dependency-free static HTML, CSS, JavaScript, and fonts. npm dependencies exist only for repeatable verification.

## Change boundaries

- Preserve exactly twenty checks, their identifiers, the 102-point raw weighting, and deterministic grade thresholds unless a separately reviewed methodology change is requested.
- Keep the score labeled as Nymrel's editorial heuristic, not a metric from OpenAI, Anthropic, Perplexity, Google, or another provider.
- Do not claim that a check, schema type, crawler directive, or perfect score guarantees crawling, indexing, ranking, citation, recommendation, traffic, conversion, or revenue.
- Keep search/index crawlers distinct from training crawlers and user-triggered fetchers. Publisher policy remains the operator's choice.
- Keep checked identifiers out of analytics and other network requests.
- Escape report markup and preserve the JSON-LD script serialization guards in every framework example.
- Do not change Pro contents, checkout, or pricing behavior without focused tests and plain-language documentation.
- Treat hosted CI, deployment, provider adoption, customer use, purchases, and revenue as separate evidence gates.
