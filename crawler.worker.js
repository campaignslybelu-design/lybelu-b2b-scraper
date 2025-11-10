import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { crawlOnce } from './crawler.js';
import { upsertCompanyAndEmail } from './db.js';
import { sleep } from './utils.js';

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const RATE = Number(process.env.CRAWL_RATE_MS || 1200);
const CONC = Number(process.env.MAX_CONCURRENCY || 6);

new Worker('crawl', async job => {
  const { url } = job.data;
  const results = await crawlOnce(url, { depth: 2 });
  for (const r of results) {
    try { await upsertCompanyAndEmail(r); } catch {}
  }
  await sleep(RATE);
  return { found: results.length };
}, { connection, concurrency: CONC });
