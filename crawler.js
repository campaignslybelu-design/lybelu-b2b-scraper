import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import robots from 'robots-txt-parse';
import { EMAIL_REGEX, getDomain, normalizeUrl } from './utils.js';

const UA = process.env.CRAWL_USER_AGENT || 'LybeluLeadsBot/1.0';

async function allowedByRobots(url) {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.origin}/robots.txt`
    const res = await fetch(robotsUrl, { headers: { 'User-Agent': UA }, timeout: 8000 });
    if (!res.ok) return true;
    const text = await res.text();
    const parsed = robots(text, { allowOnNeutral: true });
    return parsed.isAllowed(url, UA);
  } catch { return true; }
}

async function fetchHTML(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function crawlOnce(seedUrl, { depth = 2 } = {}) {
  const start = normalizeUrl(seedUrl);
  if (!start) throw new Error('Invalid URL');
  const origin = new URL(start).origin;
  const visited = new Set();
  const queue = [start];
  const emails = new Map(); // email -> source url
  let hops = 0;

  while (queue.length && hops <= 25) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    if (!(await allowedByRobots(url))) continue;

    let html;
    try { html = await fetchHTML(url); } catch { continue; }

    // Extract emails
    for (const m of html.matchAll(EMAIL_REGEX)) {
      const email = m[0].toLowerCase();
      emails.set(email, url);
    }

    // Collect internal "contact-like" links
    if (depth > 0) {
      const $ = cheerio.load(html);
      const candidates = new Set();
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const next = new URL(href, url).toString();
          if (next.startsWith(origin) && !visited.has(next)) {
            if (/(contact|about|team|support|help|locations|office|company)/i.test(next)) {
              candidates.add(next);
            }
          }
        } catch {}
      });
      for (const n of candidates) queue.push(n);
    }

    hops++;
    depth = Math.max(0, depth - 1);
  }

  const domain = getDomain(start);
  const filtered = [...emails.entries()]
    .filter(([e]) => !/example\.com|wixpress\.com|shopify\.com/i.test(e))
    .map(([email, source_url]) => ({ email, source_url, domain }));

  return filtered;
}
