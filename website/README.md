# Kasho Pay showcase site

Static site (no framework, no dependencies) in Kreyòl (`/`) and Français (`/fr/`), built for Haiti: low weight (about 0.5 MB with all screenshots), mobile first, SEO ready.

- `build.mjs` generates `index.html`, `fr/index.html`, `sitemap.xml`, `robots.txt`, `site.webmanifest`. **Edit the texts there**, then rebuild.
- `style.css`, `site.js`: design and the small menu / reveal script.
- `img/`: Kasho logo, icons, `og.jpg` (social sharing image) and the app screenshots (`app-*.webp`).

## Build for your real domain
```bash
SITE_URL=https://www.your-domain.com APP_URL=https://kasho-pay-1.onrender.com \
CONTACT_EMAIL=support@your-domain.com WHATSAPP=509XXXXXXXX node website/build.mjs
```
`SITE_URL` goes into the canonical links, hreflang, sitemap, Open Graph and structured data: **it must be the real address of the site** (the default `https://www.kashopay.ht` is a placeholder).

## Deploy on Render (Static Site)
New > Static Site > this repository. Build command: empty. Publish directory: `website`. (Or use `website/render.yaml`.) Then add the domain in Settings > Custom Domains.

## After it is online
1. Add the site in Google Search Console and Bing Webmaster Tools, and submit `/sitemap.xml`.
2. Test sharing with the Facebook Sharing Debugger and WhatsApp (the preview uses `img/og.jpg`).
3. Check the fees table: it is a copy of the default fee schedule, so update `build.mjs` if you change fees in the admin page.

## Refreshing the app screenshots
They were captured from the app with demo data (mock account "Marie Jean"). Retake them after a visual change to the app.
