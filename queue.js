import { Queue, Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

export const crawlQueue = new Queue('crawl', { connection });
export const verifyQueue = new Queue('verify', { connection });

new QueueScheduler('crawl', { connection });
new QueueScheduler('verify', { connection });

export function addCrawlJobs(urls) {
  return crawlQueue.addBulk(urls.map(url => ({
    name: 'crawl-url',
    data: { url },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: 10000,
      removeOnFail: 10000
    }
  })));
}
