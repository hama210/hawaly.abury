# هەواڵی ئابوری — Phase 8 SEO + PWA + Production Polish

Phase 8 adds production polish to the live financial intelligence platform.

## Added in Phase 8

- SEO meta tags
- Open Graph / Twitter sharing cards
- JSON-LD structured data
- `sitemap.xml`
- `robots.txt`
- PWA manifest
- Service worker for app-shell caching
- Installable app support
- App icons
- Cloudflare `_headers` security/cache rules
- Better mobile/PWA readiness

## Deploy

Upload the contents to GitHub root and commit:

```txt
Phase 8 SEO PWA production polish
```

Cloudflare settings stay the same:

```txt
Build command: npm run build
Output directory: dist
```

Important: if `package-lock.json` exists in GitHub and Cloudflare hangs on `npm clean-install`, delete `package-lock.json` and redeploy.
