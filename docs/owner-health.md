# HAWAL owner-only source health

This feature is **fail-closed**. It does not become accessible until Cloudflare Access is configured. Do not create public links to the dashboard. The only private page is `/owner-health`; its data endpoint is `/owner-health/api`.

## Required manual Cloudflare setup

1. In Cloudflare Zero Trust, create **one Access application** covering **both** `/owner-health` and `/owner-health/api`. Prefer a single path pattern `/owner-health*` (if the hostname UI supports it). A separate application for the API will have a different Access AUD and will not work with the same verifier. If the Pages-provided `pages.dev` hostname cannot be limited to an Access **path**, use a custom domain you control before configuring Access. **Do not accidentally enable Access for the entire public HAWAL website.**
2. Create an **Allow** policy for the *one, exact owner email address*. Never add an email domain, the Cloudflare Administrators group, an Everyone include rule, or a bypass for either private path. Enable an identity provider and MFA as available. HAWAL application roles have **no** effect on private access.
3. Copy the application Audience (AUD) tag and the Cloudflare Zero Trust team domain from the Access console.
4. In the Cloudflare Pages project **Production** environment, add these environment variables (prefer Secrets for identity/config settings):
   - `HAWAL_OWNER_EMAIL`: exact, owner-authorized email (provided by the owner in chat; do not commit it to GitHub).
   - `HAWAL_ACCESS_AUD`: the Access application Audience tag.
   - `HAWAL_ACCESS_TEAM_DOMAIN`: `https://<your-team>.cloudflareaccess.com`.
5. **Redeploy** production after setting the variables, and manually open `/owner-health` in a fresh private browser window. You should be sent to Cloudflare Access to sign in. Nonowner sign-ins must be denied. Open `/owner-health/api` as a nonowner as well: it must never return a JSON health report.
6. Keep Cloudflare's existing Pages production URL serving the normal public homepage, Metals, Calendar, and news. Check public routes again after enabling Access.

## Enforcement model

- Pages middleware validates the **RS256 signed** Access JWT's key ID against the Cloudflare team's live public JWK set, issuer, application audience, expiry, issue time, and exact owner email.
- `/owner-health/api` separately performs the same verification. Bare email headers, unsigned/altered JWTs, and HAWAL `admin` roles are ignored.
- Missing configuration and failed authorization return HTTP 403, not a default admin view.
- Private HTML/API responses are **no-store**, **noindex**, and are not listed in the sitemap or public navigation.
- Health checks use existing public HAWAL feed endpoints and the economic-calendar provider. **No tokens are forwarded** to those data sources.
- The interactive dashboard still refreshes full diagnostics every 15 minutes while open.
- The separate GitHub Actions workflow `.github/workflows/owner-health-watch.yml` now performs **unauthenticated read-only public-site and private-route access checks every quarter hour**, including when the dashboard is closed. It evaluates news availability, USD/IQD, gold/silver, economic calendar, metals history, homepage and whether the owner page/API deny anonymous visitors. It deliberately does **not** fetch an authenticated owner report or send owner JWTs off site.
- GitHub Actions scheduled events are *best effort*, not guaranteed to execute precisely every 15 minutes. GitHub may delay or skip runs. A failing check is visible in Actions and may trigger GitHub failure notifications if the repository owner's notification settings are configured to receive them. Notifications for scheduled workflows can be assigned to the GitHub account that last changed the cron expression; they are not guaranteed to go to the Cloudflare owner email.
- The authenticated dashboard reads recent run metadata via the public GitHub API, but only exposes the status **after** checking the owner's JWT. It cannot manufacture missing runs or claim a missed run was successful.
- ChatGPT owner-only condition monitoring, when separately enabled, may send private alerts in the owner's ChatGPT account (limited to hourly checks). An **email to muhammadch14@gmail.com is not sent by this workflow**; do not describe email delivery as configured.
- No Cloudflare Cron Worker, public monitor data files, persistent private backend history or external mail-service credentials are created.
- There are limits to the phrase "only owner": someone with full access to change the GitHub/Cloudflare deployment or Cloudflare Access policies can alter server code or security settings. Protect those accounts with MFA.

## Testing

`npm test` covers signed JWT verification, forged-header rejection, wrong owner/admin email rejection, unauthenticated 403s for both private endpoints, safe public routing, health-source assessments and data freshness.

The public live smoke workflow checks unauthenticated visitors get a 403 or a Cloudflare Access login redirect for the private paths. It **does not** authenticate as the owner or verify live private data until the required cloud environment variables are configured.

## Background scheduler

- GitHub workflow: [HAWAL owner-only uptime watch](https://github.com/hama210/hawaly.abury/actions/workflows/owner-health-watch.yml)
- Source and tests: `scripts/owner-health-watch.mjs`, `tests/owner-health-watch.test.js`, `tests/owner-background-status.test.js`.
- Cron: `11,26,41,56 * * * *` (UTC; 96 expected checks/day, if GitHub runs all of them).
- Public-only sources: `/`, `/api/news?mode=fast&limit=8`, `/api/markets`, calendar provider API and `/api/metals-history`.
- Confidential routes: `/owner-health` and `/owner-health/api`. Both **must return 403 or redirect to the verified Cloudflare Access login** when requested anonymously; a 200 triggers a critical failure.
- GitHub workflow uses `permissions: contents: read` and no owner credentials or third-party secrets.
- A single failed public-source request is rechecked before marking a critical incident; normal quiet news feeds and CBI-source gaps do not masquerade as global outages.
- GitHub logs and workflow statuses on a public repository are visible to viewers: they contain only non-personal health-check summaries, never an owner email, Access token, or private dashboard data.
- Owner notifications: enable GitHub Actions failure notification preferences for the workflow-owner account; alternatively use a separate private ChatGPT condition watch. Do not imply automatic email delivery unless it has been tested.
- To test immediately after merge: check the latest `push` run from the default branch, then await the first `schedule` run. The initial push run proves the script can execute but does not prove that GitHub will execute future cron events precisely.

## Owner incident history (bounded and authenticated)

- `functions/lib/owner-watch-status.js` reads recent completed GitHub Actions workflow-run metadata (up to three pages of 100, roughly three days at the intended 15-minute cadence) using the public GitHub API, deduplicates by run ID and groups consecutive **failed check runs**.
- Each group records first failed check, last failed check, count of failed checks, first following successful check (if any), estimated duration and a URL to that GitHub Actions run. Exact incident start/recovery times are not known between checks.
- A failed workflow can reflect a bad website state **or a failed GitHub runner**, not necessarily a proven outage. The run's own logs explain which source or Cloudflare Access route failed; do not label all failures a proven site outage. Cancelled and pending runs never prove recovery.
- The history is included **only inside `/owner-health/api` after existing RS256 owner JWT verification**, then rendered inside the existing `/owner-health` component. No new public endpoint, Cloudflare binding, service token or private-data GitHub write was introduced.
- This is **recent workflow run history**, not a permanent database. Older entries expire or fall outside the 300-run window. A longer, truly private long-term audit log needs a separately provisioned private storage service such as Cloudflare D1 with scoped credentials, which is not configured by this change.
- GitHub workflow metadata/logs are public because this repository is public; only the curated display inside HAWAL is gated by Access. The underlying public run status is not private data. No owner emails or tokens are included in run logs.
- If GitHub API is temporarily unavailable, UI clearly reports the history as unavailable and never pretends no incidents occurred.

## Owner email notification

- The existing hourly ChatGPT private HAWAL condition-watch automation uses the connected Gmail service as the sender and targets the owner's already-authorized contact address. Its notification rules require a **new, confirmed critical incident** or confirmed recovery and should deduplicate notifications using prior sent message subjects or incident identifiers.
- This external ChatGPT automation is **not** a Cloudflare Pages email service or the GitHub Actions workflow. Its operation depends on the connected Gmail account and scheduled task staying enabled; it cannot guarantee immediate/15-minute delivery.
- No OAuth secrets, SMTP passwords or personal email address are committed to this public repository. If the connection breaks, the private ChatGPT task should notify the owner in chat instead of misreporting email delivery.
- Never send email for quiet RSS feeds, temporary source errors, weekend market closures or a single missing CBI quote.
