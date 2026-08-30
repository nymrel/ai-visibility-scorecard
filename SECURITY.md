# Security policy

## Supported version

Security fixes target the current `main` branch. This source repository does not itself prove what is deployed at nymrel.com.

## Reporting a vulnerability

Email `contact@nymrel.com` with the affected path, reproduction steps, impact, and any suggested mitigation. Please do not open a public issue for an unpatched vulnerability or include real customer, checkout, or credential data in a report.

## Security boundary

AI Visibility Scorecard stores checked item identifiers in browser local storage. The product must not attach those selections to analytics or other network requests. A hosted visit also loads static assets and aggregate Vercel Web Analytics.

The Pro report is assembled in the browser from those check identifiers. Dynamic values must be HTML-escaped before insertion into report markup. JSON-LD examples that use React's `dangerouslySetInnerHTML` must encode literal `<` characters as `\u003c`; PHP examples must use `JSON_HEX_TAG`.

Checkout verification and paid artifact delivery are separate server-backed boundaries. Verification must fail closed when its verifier is unavailable.

There is no public bug-bounty promise. We will acknowledge actionable reports and coordinate remediation proportionate to the issue.
