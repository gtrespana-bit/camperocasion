// Simple in-memory cache for product data
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: any;
  timestamp: number;
}

class ProductCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache is expired
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Generate a cache key from filters
  generateKey(filters: Record<string, string>): string {
    const sortedEntries = Object.entries(filters)
      .filter(([_, value]) => value !== '')
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(sortedEntries);
  }
}

export const productCache = new ProductCache();