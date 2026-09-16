// Sistema de caché del lado del cliente para productos
class ClientCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutos

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Verificar si la caché ha expirado
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Verificar si la caché ha expirado
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  // Generar clave única para filtros
  generateKey(filters: Record<string, string | number | boolean | undefined>): string {
    const filteredFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
    );
    
    const sortedEntries = Object.entries(filteredFilters)
      .sort(([a], [b]) => a.localeCompare(b));
      
    return JSON.stringify(sortedEntries);
  }
}

export const clientCache = new ClientCache();