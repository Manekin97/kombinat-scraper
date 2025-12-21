import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  performScraping,
  getPreviousState,
  calculateDiff,
  sendSmsNotification,
  saveCurrentState,
  randomDelay,
} from './utils.js';
import { LISTINGS_KV_KEY } from './consts.js';
import { env } from './env.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;

  if (env.NODE_ENV === 'production' && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

    if (env.NODE_ENV === 'production') {
      await randomDelay(0, 20_000);
    }

  try {
    const result = await performScraping();
    const previousState = await getPreviousState(LISTINGS_KV_KEY);

    const diff = calculateDiff(result.listings, previousState?.listings || []);

    if (diff.changed.length > 0) {
      await sendSmsNotification(diff);
    }

    await saveCurrentState(LISTINGS_KV_KEY, result.listings);

    return res.status(200).json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      diff,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
