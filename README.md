# AI Visibility Scorecard

Run a 20-item self-audit of the access, machine-readable context, content clarity,
technical delivery, and corroboration foundations that can support search and
AI-assisted discovery.

**Use it:** https://nymrel.com/tools/ai-visibility-scorecard

## What it does

You independently verify each item and tick the ones your site already satisfies. The
tool applies Nymrel's documented editorial weights and prioritizes the unchecked
items. The result is a readiness checklist, not a measurement from OpenAI, Anthropic,
Perplexity, Google, or another provider.

The score cannot prove or predict crawling, indexing, ranking, citation, recommendation,
or traffic. Provider behavior, query relevance, source quality, and live system state
remain outside this browser-only self-audit. `llms.txt` is an open proposal with
variable support; Google Search currently says it ignores the file for visibility and
rankings.

No account, no email gate, no trial clock.

## Run it locally

The shipped product has no build step or runtime dependencies. The repository has
development-only dependencies for repeatable static, browser, accessibility, and
responsive acceptance.

```
git clone https://github.com/nymrel/ai-visibility-scorecard.git
cd ai-visibility-scorecard
npm ci --ignore-scripts
npx playwright install chromium
npm run check
```

For an interactive local server, run `npm run serve:test` and open
http://localhost:4173/tools/ai-visibility-scorecard/.

The page loads its stylesheet, script, and fonts from absolute paths (`/assets/...`),
so it needs a server rooted at the repo folder. Opening the HTML file straight from
disk will render unstyled.

## What is in here

| Path | What it is |
| --- | --- |
| `tools/ai-visibility-scorecard/index.html` | The whole tool — markup, copy, and logic |
| `assets/site.css`, `assets/site.js` | Shared styles and behavior across the Nymrel tools |
| `assets/pro/` | The paid-tier report module, as shipped |
| `assets/checkout-config.js` | The checkout registry template |
| `assets/fonts/` | The three fonts the page uses |

`tools/ai-visibility-scorecard/index.html` is byte-for-byte the file nymrel.com serves.

## A note on the paid tier

The page offers a paid report. `assets/checkout-config.js` here is the committed
template with no payment links set, so in a local copy the upgrade button falls back
to email. The free scorecard is complete on its own.

## Privacy

The checked item identifiers are stored in this browser's local storage. The scorecard
does not attach those selections to its requests. A hosted visit still requests the
page's static assets and Vercel Web Analytics, so this is not a claim that the page
makes no network requests. Review Vercel's privacy documentation for the hosted
analytics boundary.

## Credits

Instrument Serif, Instrument Sans, and IBM Plex Mono are used under the SIL Open
Font License.

## Who built it

[Nymrel](https://nymrel.com) — we build and run products, services, websites, software,
and apps.

## License

MIT. See [LICENSE](LICENSE).
