# Ruxstar

Minimal Next.js frontend for backend connectivity demos.

## Setup

```bash
npm install
```

Create `.env.local`:

```bash
BACKEND_URL=https://your-backend.example.com
```

## Development

```bash
npm run dev
```

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

Set `BACKEND_URL` on Cloud Run at deploy time (runtime env, not baked into the client).
