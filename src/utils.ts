import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';
import _ from 'lodash';
import twilio from 'twilio';
import type { ListingKvItem, ScrapingResult, KVState } from './types.js';
import { LISTING_URL, USER_AGENTS } from './consts.js';
import { env } from './env.js';

export const getPreviousState = async (key: string): Promise<KVState | null> =>
  kv.get<KVState>(key);

export const saveCurrentState = async (key: string, listings: ListingKvItem[]): Promise<void> => {
  await kv.set(key, {
    listings,
    lastUpdated: new Date().toISOString(),
  });
};

export const randomDelay = async (minMs: number = 1000, maxMs: number = 30000) => {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);

  return new Promise((resolve) => setTimeout(resolve, delay));
};

export const calculateDiff = (current: ListingKvItem[], previous: ListingKvItem[]) => {
  const changed = current
    .map((item) => {
      const previousItem = previous.find(
        ({ type, number }) => type === item.type && number === item.number
      );

      if (!previousItem) {
        return;
      }

      if (previousItem.status !== item.status) {
        return { item, previousStatus: previousItem.status };
      }

      return;
    })
    .filter((item) => item !== null);

  return { changed };
};

export async function sendSmsNotification(diff: {
  changed: { item: ListingKvItem; previousStatus: string }[];
}) {
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  const messageParts = ['Kombinat Update:'];

  if (diff.changed.length > 0) {
    const changedDetails = diff.changed
      .map(
        ({ item, previousStatus }) =>
          `${item.type === 'parking' ? 'p' : 'm'}${item.number}(${previousStatus}->${item.status})`
      )
      .join(',');

    messageParts.push(`Zmieniono status: ${changedDetails}`);
  }

  try {
    await client.messages.create({
      body: messageParts.join(' | '),
      from: env.TWILIO_PHONE_NUMBER,
      to: env.TARGET_PHONE_NUMBER,
    });
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function performScraping(): Promise<ScrapingResult> {
  try {
    const html = await fetchHtml(LISTING_URL);
    const $ = cheerio.load(html);
    const listings = parseListings($);

    const uniqueListings = _.uniqBy(listings, (item) => `${item.type}-${item.number}-${item.status}`);

    const apartmentsCount = uniqueListings.filter((item) => item.type === 'apartment').length;
    const parkingSpotsCount = uniqueListings.filter((item) => item.type === 'parking').length;

    return {
      itemsProcessed: uniqueListings.length,
      apartmentsCount,
      parkingSpotsCount,
      status: 'completed',
      listings: uniqueListings,
      scrapedAt: new Date().toISOString(),
      url: LISTING_URL,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    throw new Error(`Failed to scrape ${LISTING_URL}: ${errorMessage}`);
  }
}

async function fetchHtml(url: string): Promise<string> {
  const cachePath = path.join(process.cwd(), 'api', 'cache.html');

  if (env.NODE_ENV !== 'production' && fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf-8');
  }

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  const response = await axios.get(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    timeout: 10000,
  });

  if (env.NODE_ENV !== 'production') {
    fs.writeFileSync(cachePath, response.data);
  }

  return response.data;
}

function parseListings($: cheerio.CheerioAPI): ListingKvItem[] {
  const listings: ListingKvItem[] = [];
  const pattern = /Jana\s+Kochanowskiego\s+(m\.p\.|m\.)\s+(\d+)/i;

  $('tr').each((_, element) => {
    const $row = $(element);
    const text = $row.text().trim();
    const match = text.match(pattern);

    if (!match) {
      return;
    }

    const typeIndicator = match[1].toLowerCase();
    const number = match[2];
    const type: 'apartment' | 'parking' = typeIndicator.includes('p') ? 'parking' : 'apartment';
    const status = $row.find('td[class*="status-color"]').text().trim() || 'Unknown';

    listings.push({
      number,
      type,
      status,
    });
  });

  return listings;
}
