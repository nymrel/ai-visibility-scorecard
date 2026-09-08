# Scrape-Verse submission checklist

This branch is a credential-free, testable scaffold. It is **not yet a competition-ready submission**.

## Completed in code

- Public-target URL policy rejects HTTP, credentials, local/private/reserved network targets, government domains, and obvious login/account/paywall paths.
- Bright Data trigger and dataset-polling client uses dependency injection and has offline tests.
- Optional collector-template repair call is isolated behind an explicit command.
- Flexible normalization, deduplication, baseline comparison, JSON artifacts, and Markdown report generation are implemented.
- The demo is deterministic and makes no network calls.

## Nymrel / operator actions still required

- Register for the event and accept the current official rules.
- Create or approve the Bright Data account and API-token storage path.
- Build a **custom** Scraper Studio collector from `collector-prompt.md`; return the collector ID.
- Select one clearly public, non-government, non-login, non-paywalled target whose terms permit collection.
- Run the collector through Bright Data and retain the real collection ID and structured output.
- Review the output for personal or restricted data before it enters the repository or demo.
- Validate the self-healing path only if the original collector breaks; do not manufacture a failure.
- Decide whether this branch may become public submission code, and confirm inherited repository/license fit.
- Record AI-assistant use and disclose it as required by the event.
- Capture a concise demo video showing Bright Data as a central feature.
- Submit through the official event path only after exact-head tests and independent review.

## Stop conditions

Stop on unexpected billing, a target that needs authentication or circumvention, personal data, a government target, unclear collection rights, exposed credentials, an event deadline mismatch, or a request to misstate whether Bright Data ran successfully.
