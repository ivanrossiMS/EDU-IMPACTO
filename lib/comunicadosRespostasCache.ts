'use client';

export interface ChatMessageReaction {
  emoji: string;
  user_id: string;
  user_name: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  comunicado_id: string;
  original_comunicado_id?: string;
  remetente_id: string;
  destinatario_id?: string;
  remetente_nome: string;
  conteudo: string;
  anexos: any[];
  is_admin: boolean;
  created_at: string;
  reacoes?: ChatMessageReaction[];
}

const MAX_CACHE_SIZE = 150;
const messagesCache = new Map<string, ChatMessage[]>();
const inFlightRequests = new Map<string, Promise<ChatMessage[]>>();

function normalizeKey(id: string | number | undefined | null): string {
  if (!id) return '';
  return String(id).trim();
}

function enforceCacheLimit(): void {
  if (messagesCache.size > MAX_CACHE_SIZE) {
    let count = 0;
    for (const key of messagesCache.keys()) {
      messagesCache.delete(key);
      count++;
      if (count >= 30) break;
    }
  }
}

export function getGlobalCachedMessages(id: string | number | undefined | null): ChatMessage[] | undefined {
  const key = normalizeKey(id);
  if (!key) return undefined;
  
  if (messagesCache.has(key)) {
    return messagesCache.get(key);
  }
  
  // Fallback to sessionStorage for instantaneous navigation
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(`edu_com_msg_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          messagesCache.set(key, parsed);
          return parsed;
        }
      }
    } catch(e) {}
  }
  return undefined;
}

export function setGlobalCachedMessages(id: string | number | undefined | null, msgs: ChatMessage[]): void {
  const key = normalizeKey(id);
  if (!key || !Array.isArray(msgs)) return;

  messagesCache.set(key, msgs);
  enforceCacheLimit();

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(`edu_com_msg_${key}`, JSON.stringify(msgs));
    } catch(e) {}
  }
}

export function seedComunicadosRespostasCache(comunicados: any[]): void {
  if (!Array.isArray(comunicados)) return;
  comunicados.forEach(c => {
    if (!c || !c.id) return;
    const msgs = c.respostas || c.dados?.respostas;
    if (Array.isArray(msgs)) {
      setGlobalCachedMessages(c.id, msgs);
    }
  });
}

export function addOrUpdateCachedMessage(comunicadoId: string, msg: ChatMessage): void {
  const key = normalizeKey(comunicadoId);
  if (!key || !msg || !msg.id) return;

  const current = getGlobalCachedMessages(key) || [];
  const exists = current.some(m => m.id === msg.id);
  const updated = exists ? current.map(m => m.id === msg.id ? { ...m, ...msg } : m) : [...current, msg];
  setGlobalCachedMessages(key, updated);
}

export function removeCachedMessage(comunicadoId: string, msgId: string): void {
  const key = normalizeKey(comunicadoId);
  if (!key || !msgId) return;

  const current = getGlobalCachedMessages(key) || [];
  const updated = current.filter(m => m.id !== msgId);
  setGlobalCachedMessages(key, updated);
}

export async function prefetchComunicadoMessages(
  comunicado: any,
  isAdmin: boolean = false,
  currentUserSlug?: string | null,
  espelharColabId?: string | null
): Promise<ChatMessage[]> {
  if (!comunicado || !comunicado.id) return [];
  const key = normalizeKey(comunicado.id);
  
  // If already in cache and not empty, return cached
  const cached = getGlobalCachedMessages(key);
  if (cached && cached.length > 0) {
    return cached;
  }

  // Deduplicate in-flight requests
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!;
  }

  const isGroupedReport = key.startsWith('AD-COM-REL-COLAB') || key.startsWith('AD-COM-REL-TURMA') || (key.startsWith('AD-COM-REL-') && !key.startsWith('AD-COM-REL-STU-'));
  const autorId = comunicado.autorId || comunicado.dados?.autorId;
  const espelharParam = espelharColabId ? `&espelhar_colaborador=${encodeURIComponent(espelharColabId)}` : '';

  let url = '';
  if (isAdmin) {
    if (isGroupedReport && autorId) {
      const gDate = new Date(comunicado.dataEnvio || comunicado.created_at || 0).getTime();
      url = `/api/comunicados_respostas?grouped_autor_id=${encodeURIComponent(autorId)}&grouped_time=${gDate}&admin=true${espelharParam}`;
    } else {
      url = `/api/comunicados_respostas?comunicado_id=${encodeURIComponent(key)}&admin=true${espelharParam}`;
    }
  } else {
    url = `/api/comunicados_respostas?comunicado_id=${encodeURIComponent(key)}&remetente_id=${encodeURIComponent(currentUserSlug || '')}${espelharParam}`;
  }

  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const unique = Array.from(new Map(data.map((m: any) => [m.id, m])).values()) as ChatMessage[];
          if (isAdmin) {
            setGlobalCachedMessages(key, unique);
          }
          if (typeof window !== 'undefined' && unique.length > 0) {
            window.dispatchEvent(new CustomEvent('agenda-digital:conversas-updated', {
              detail: { comunicadoId: key, total: unique.length, messages: unique }
            }));
          }
          return unique;
        }
      }
      return [];
    } catch(e) {
      console.warn('Prefetch error:', e);
      return [];
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}
