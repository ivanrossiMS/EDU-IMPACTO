'use client';

// Cache global em memória durante a sessão da aplicação
const photoCache = new Map<string, string | null>();
const inFlightRequests = new Map<string, Promise<Record<string, string | null>>>();

export function getCachedStudentPhoto(id: string | number | undefined | null): string | null | undefined {
  if (!id) return undefined;
  const key = String(id).trim().replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
  if (!key) return undefined;
  return photoCache.get(key);
}

export function setCachedStudentPhoto(id: string | number | undefined | null, photo: string | null): void {
  if (!id) return;
  const key = String(id).trim().replace(/^a_?/, '').replace(/^_*(ALU)?/, '');
  if (!key) return;
  photoCache.set(key, photo);
}

export async function fetchStudentPhotos(ids: (string | number)[]): Promise<Record<string, string | null>> {
  const cleanIds = Array.from(
    new Set(
      ids
        .map(id => String(id || '').trim().replace(/^a_?/, '').replace(/^_*(ALU)?/, ''))
        .filter(Boolean)
    )
  );

  if (cleanIds.length === 0) return {};

  const missingIds: string[] = [];
  const result: Record<string, string | null> = {};

  cleanIds.forEach(id => {
    if (photoCache.has(id)) {
      result[id] = photoCache.get(id) || null;
    } else {
      missingIds.push(id);
    }
  });

  if (missingIds.length === 0) {
    return result;
  }

  // Chave do lote para deduplicação de requisições simultâneas
  const batchKey = missingIds.sort().join(',');
  if (inFlightRequests.has(batchKey)) {
    const fetched = await inFlightRequests.get(batchKey)!;
    return { ...result, ...fetched };
  }

  const promise = (async () => {
    try {
      const res = await fetch('/api/alunos/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: missingIds })
      });

      if (!res.ok) {
        console.warn('[studentPhotoCache] Erro ao buscar fotos:', res.status);
        return {};
      }

      const data = await res.json();
      const photos = data?.photos || {};

      missingIds.forEach(id => {
        const photo = photos[id] || photos[`a_${id}`] || null;
        photoCache.set(id, photo);
        result[id] = photo;
      });

      return photos;
    } catch (e) {
      console.warn('[studentPhotoCache] Falha na requisição de fotos:', e);
      return {};
    } finally {
      inFlightRequests.delete(batchKey);
    }
  })();

  inFlightRequests.set(batchKey, promise);
  await promise;

  return result;
}
