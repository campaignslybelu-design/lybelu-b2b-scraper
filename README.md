# Lybelu B2B Scraper (Render-ready) — with Dashboard

Collect nationwide B2B **public emails** from company websites and export CSV.
Includes queue workers for **5–10k URLs/day** and a small dashboard at `/`.

## Services
- **Web API + Dashboard** (`/enqueue`, `/crawl`, `/export.csv`, `/stats`, `/recent`, `/health`)
- **Crawler Worker** (BullMQ + Redis)
- **Verifier Worker** (nightly email check via API)
- **Postgres** (companies, emails, campaigns)
- **Redis** (queues)

## Quick Start (Local)
1. `cp .env.example .env` and fill values.
2. `npm install`
3. Start API: `node server.js`
4. Start workers (separate terminals):  
   - `node crawler.worker.js`  
   - `node verifier.worker.js`
5. Open http://localhost:3000/ to use the dashboard.

## Deploy to Render
- Connect this repo.
- Add a **Postgres** and **Redis** instance.
- Use `render.yaml` or create 3 services manually.
- Set env vars (`DATABASE_URL`, `REDIS_URL`, `EMAIL_VERIFY_API_KEY`, etc.).

---

*Generated 2025-11-10T14:33:25.901806Z*
