const memCache = new Map<string, { value: any, timestamp: number }>();
export const CACHE_TTL = 300_000; // 5 minutos

export function getPerfilAcessoCache(key: string) {
  return memCache.get(key);
}

export function setPerfilAcessoCache(key: string, value: any) {
  memCache.set(key, { value, timestamp: Date.now() });
}

export function clearPerfilAcessoCache(slug?: string) {
  if (!slug) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    if (key.includes(`-${slug}-`)) {
      memCache.delete(key);
    }
  }
}
