# Hawali Aburi

Multilingual financial news and market intelligence for Iraq and the Kurdistan Region.

## Local development

```sh
npm ci
npm run dev
```

Run the reliability tests and production build before deploying:

```sh
npm run check
```

## Deploy

Cloudflare Pages settings:

```txt
Build command: npm run build
Output directory: dist
```

Keep `package-lock.json` committed so local, CI, and Cloudflare builds use the same dependency versions.
