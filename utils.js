import { stringify } from 'csv-stringify/sync';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function toCSV(rows) {
  return stringify(rows, { header: true });
}

export function normalizeUrl(u) {
  try { return new URL(u).toString(); } catch { return null; }
}

export function getDomain(u) {
  try { return new URL(u).hostname.replace(/^www\./,''); } catch { return null; }
}

// Simple public business email pattern
export const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
