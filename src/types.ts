export interface ListingItem {
  number: string;
  type: 'apartment' | 'parking';
  status: string;
  fullText: string;
}

export type ListingKvItem = Omit<ListingItem, 'fullText'>;

export interface ScrapingResult {
  itemsProcessed: number;
  apartmentsCount: number;
  parkingSpotsCount: number;
  status: string;
  listings: ListingKvItem[];
  scrapedAt: string;
  url: string;
}

export interface KVState {
  listings: ListingKvItem[];
  lastUpdated: string;
}
