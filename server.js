import express from 'express';
import { ensureSchema, listLeads, pool } from './db.js';
import { crawlOnce } from './crawler.js';
import { getDomain, toCSV } from './utils.js';
import { addCrawlJobs, crawlQueue } from './queue.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

await ensureSchema();

app.get('/health', (_req, res) => res.send('ok'));

// Direct crawl (small tests)
app.post('/crawl', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });

  if (process.env.ALLOWED_DOMAINS) {
    const allow = process.env.ALLOWED_DOMAINS.split(',').map(s => s.trim());
    const dom = getDomain(url);
    if (dom && !allow.includes(dom)) {
      return res.status(403).json({ error: 'domain not allowed' });
    }
  }

  try {
    const results = await crawlOnce(url, { depth: 2 });
    res.json({ found: results.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Enqueue for workers
app.post('/enqueue', async (req, res) => {
  const { urls = [] } = req.body || {};
  if (!urls.length) return res.status(400).json({ error: 'urls required' });
  const added = await addCrawlJobs(urls);
  res.json({ queued: added.length });
});

// Nightly verify trigger (cron-friendly placeholder)
app.post('/jobs/nightly-verify', async (_req, res) => {
  res.json({ ok: true, note: "Verifier worker runs independently." });
});

// Export CSV
app.get('/export.csv', async (req, res) => {
  const rows = await listLeads({ domain: req.query.domain });
  res.setHeader('Content-Type', 'text/csv');
  res.send(toCSV(rows));
});

// Stats for dashboard
app.get('/stats', async (_req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      crawlQueue.getWaitingCount(),
      crawlQueue.getActiveCount(),
      crawlQueue.getCompletedCount(),
      crawlQueue.getFailedCount()
    ]);
    res.json({
      waiting, active, completed, failed,
      concurrency: Number(process.env.MAX_CONCURRENCY || 6),
      rate_ms: Number(process.env.CRAWL_RATE_MS || 1200)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recent rows for dashboard
app.get('/recent', async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '25', 10)));
  try {
    const { rows } = await pool.query(`
      select c.domain, e.email, e.status, e.source_url, e.last_seen
      from emails e join companies c on c.id=e.company_id
      order by e.last_seen desc
      limit $1
    `, [limit]);
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
