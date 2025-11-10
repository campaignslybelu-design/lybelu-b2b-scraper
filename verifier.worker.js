import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import fetch from 'node-fetch';
import { pool } from './db.js';

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

async function verifyEmail(email) {
  const key = process.env.EMAIL_VERIFY_API_KEY;
  if (!key) return 'unknown';
  // Example Mailboxlayer-like endpoint (swap to your provider and params)
  const url = `https://apilayer.net/api/check?access_key=${key}&email=${encodeURIComponent(email)}&smtp=1&format=1`;
  const res = await fetch(url, { timeout: 12000 });
  const j = await res.json();
  if (j.smtp_check === true) return 'valid';
  if (j.did_you_mean) return 'typo';
  return 'invalid';
}

new Worker('verify', async job => {
  const { rows } = await pool.query(`
    select id, email from emails
    where (status is null or status='unknown') limit 500
  `);
  for (const r of rows) {
    try {
      const status = await verifyEmail(r.email);
      await pool.query(\`update emails set status=$1, verified_at=now() where id=$2\`, [status, r.id]);
    } catch {
      await pool.query(\`update emails set status='unknown' where id=$1\`, [r.id]);
    }
  }
  return { verified: rows.length };
}, { connection, concurrency: 1 });
