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
- The first release rechecks every 15 minutes **only while the dashboard is open**. No Cloudflare Cron Worker, persistent backend history, or email/push alert delivery has been enabled. Do not describe it as unattended 24/7 monitoring.
- There are limits to the phrase "only owner": someone with full access to change the GitHub/Cloudflare deployment or Cloudflare Access policies can alter server code or security settings. Protect those accounts with MFA.

## Testing

`npm test` covers signed JWT verification, forged-header rejection, wrong owner/admin email rejection, unauthenticated 403s for both private endpoints, safe public routing, health-source assessments and data freshness.

The public live smoke workflow checks unauthenticated visitors get a 403 or a Cloudflare Access login redirect for the private paths. It **does not** authenticate as the owner or verify live private data until the required cloud environment variables are configured.
