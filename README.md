# AI Visibility Scorecard

Grade your site against the checks that decide whether ChatGPT, Claude, and Perplexity
can find, read, and cite it. It runs in your browser and ranks the fixes by impact.

**Use it:** https://nymrel.com/tools/ai-visibility-scorecard

## What it does

You give it your site. It walks through the things an AI assistant needs before it can
quote you — a readable `robots.txt`, a sitemap it can reach, an `llms.txt`, structured
data, canonical URLs, real page titles and descriptions — and scores each one. The
output is a ranked list: what is missing, and which gap costs you the most.

No account, no email gate, no trial clock.

## Run it locally

No build step and no dependencies. It is a static page.

```
git clone https://github.com/nymrel/ai-visibility-scorecard.git
cd ai-visibility-scorecard
python3 -m http.server 8000
```

Then open http://localhost:8000/tools/ai-visibility-scorecard/

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

Nothing you type leaves your browser. The tool makes no server calls.

## Credits

Instrument Serif, Instrument Sans, and IBM Plex Mono are used under the SIL Open
Font License.

## Who built it

[Nymrel](https://nymrel.com) — a software studio that builds and runs its own products.

## License

MIT. See [LICENSE](LICENSE).
