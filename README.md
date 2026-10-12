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
