# PDF Compressor Backend (Render-ready)

Ghostscript-backed PDF compressor for My Workspace. Deploy this service to Render (or any host with Ghostscript) and point the frontend to its `/compress` endpoint.

## Endpoints
- `GET /healthz` — quick check, returns `{ ok: true, gs: true }` if Ghostscript is available.
- `POST /compress` — form-data:
  - `pdf`: file (PDF required)
  - `mode`: `quality-screen | quality-ebook | quality-printer | max-1mb` (default: `quality-ebook`)
  - Returns compressed PDF (headers include original/compressed size).

## Environment
- `PORT` (default `4000`)
- `GS_BIN` (optional; default `gs` on Linux/Render, `gswin64c` on Windows)
- `ALLOWED_ORIGINS` (optional CSV for CORS; default `*`)

## Local run
```bash
cd pdf-backend
npm install
node server.js
# then POST http://localhost:4000/compress with form-data pdf=<file>
```

## Deploy to Render
1. New Web Service → connect repo → root `/pdf-backend`.
2. Runtime: Node.
3. Build command: `npm install` (or leave blank if Render auto-installs).
4. Start command: `npm start`.
5. Add env:
   - `PORT`: `10000` (Render default)
   - `GS_BIN`: `/usr/bin/gs`
   - (Optional) `ALLOWED_ORIGINS`: your Vercel domain, e.g. `https://your-app.vercel.app`
6. Enable “Auto-Deploy” if desired.

## Frontend usage
Call `POST https://<your-render-app>.onrender.com/compress` with form-data `pdf` and optional `mode`. Match this URL in your frontend fetch call or env variable (e.g. `NEXT_PUBLIC_PDF_API_BASE`).***
