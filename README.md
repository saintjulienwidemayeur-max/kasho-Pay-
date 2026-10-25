# Kasho Pay Frontend

TanStack Start + React PWA. It contains no secret key: it talks to Supabase (login, own data,
KYC uploads) with the public key, and to the separate **kasho-pay-backend** for everything
that moves money.

## Run it

Start the backend first (see its README), then:

```bash
npm install
npm run dev        # http://localhost:5173
```

`.env` (already filled): `VITE_SUPABASE_*` and `VITE_API_URL=http://localhost:4000`.
In Supabase > Authentication > URL Configuration add `http://localhost:5173/**` as a Redirect URL.

## Screens

Welcome, Sign up (email verification), Log in / Forgot / Reset password, Home (balance, add money,
withdraw, history), Transfer (by @username, QR), Card (create, fund, freeze, reveal, close),
Transactions, Identity verification (document + selfie), Profile, Security.

## French version
EN / FR switch in the header (and on the login pages, and Profile > App settings). The choice is remembered; first visit follows the browser language.
Texts live in `src/lib/i18n/fr.ts`. To find missing translations open the app with `?i18n-debug=1` and read the browser console (`[i18n] untranslated: ...`), then add the English text and its French version to `FR`.

## MonCash / NatCash logos
Put the official files in `public/logos/` as `moncash.png` and `natcash.png` (svg or webp also work). Until then a colored monogram is shown.

## Deploy on Render

Create a **Web Service** (not a Static Site). Build command: `npm install && npm run build`. Start command: `npm start`. Add the variables from `.env.example` (VITE_* values are read at build time, so set them before the first build; VITE_API_URL is the public URL of the backend). Then add the frontend URL to the backend `CORS_ORIGINS` and to Supabase Authentication > URL Configuration.

## Deploy on Cloudflare (Workers)
Another host option next to Render. The backend stays on Render (it needs a server that is always running).

1. Cloudflare > Workers & Pages > Create > connect this repository (branch `main`).
2. Build command: `npm install && npm run build:cloudflare`. Deploy command: `npx wrangler deploy`.
3. Variables (build and Worker): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` (public URL of the backend), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
4. Add the new address to the backend (`CORS_ORIGIN`, `FRONTEND_URL`) and to Supabase > Authentication > URL Configuration (Site URL and Redirect URLs).

Settings live in `wrangler.jsonc`. Try it first on the `*.workers.dev` address (sign up, log in, deposit) before moving the main domain.
