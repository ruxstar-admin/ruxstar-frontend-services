# Ruxstar

Next.js frontend for the Ruxstar platform.

## Setup

```bash
npm install
```

Create `.env.local`:

```bash
BACKEND_URL=http://localhost:8080
```

## Development

```bash
npm run dev
```

## Project structure

```
app/
  page.tsx                 # Landing page
  login/                   # Login (password + OTP)
  signup/                  # Signup flow
  customer/                # Customer dashboard (placeholder)
  business/                # Vendor dashboard (placeholder)
  delivery/                # Delivery dashboard (placeholder)
  api/[...path]/           # Proxies all /api/* → BACKEND_URL/*

lib/
  proxy.ts                 # Server-side backend proxy
  api.ts                   # Client-side API helpers

components/
  globe.tsx                # Landing page globe
  particles.tsx            # Landing page particles
```

API calls from the browser go to `/api/...` (e.g. `/api/auth/signup/send-otp`), which Next.js forwards to the backend.

## Production

```bash
npm run build
npm start
```

## Docker & Cloud Run

```bash
docker build -t ruxstar-frontend .
docker run --rm -p 8080:8080 \
  -e BACKEND_URL="https://your-backend.example.com" \
  ruxstar-frontend
```

Set `BACKEND_URL` on Cloud Run at deploy time.
