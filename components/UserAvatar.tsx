import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getOptimizedUrl } from '@/lib/utils/image';

// In-memory cache to share across instances and avoid duplicate requests
const photoCache: Record<string, string | null | undefined> = {};
const pendingPromises: Record<string, Promise<string | null> | undefined> = {};

function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function fetchUserPhoto(userId?: string, name?: string): Promise<string | null> {
  const cacheKey = userId || `name:${name}`;
  if (photoCache[cacheKey] !== undefined) {
    return photoCache[cacheKey]!;
  }
  const pending = pendingPromises[cacheKey];
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      let foto = null;
      
      // Check system_users table first
      try {
        let query = supabase.from('system_users').select('foto, foto_url, dados');

        let shouldQuerySystemUsers = true;
        if (userId) {
          if (isValidUuid(userId)) {
            query = query.or(`id.eq."${userId}",auth_id.eq."${userId}"`);
          } else {
            // system_users id is UUID. If userId is not UUID, do not query it by id.
            shouldQuerySystemUsers = false;
          }
        } else if (name) {
          query = query.eq('nome', name);
        } else {
          shouldQuerySystemUsers = false;
        }

        if (shouldQuerySystemUsers) {
          const { data, error } = await query.maybeSingle();
          if (data) {
            foto = data.foto_url || data.foto || (data.dados as any)?.foto || (data.dados as any)?.fotoUrl || (data.dados as any)?.foto_url;
          }
        }
      } catch (e) {
        // Ignore system_users query error
      }

      // Check alunos table if not found
      if (!foto && userId) {
        try {
          const { data: alunoData } = await supabase.from('alunos').select('foto, foto_url, dados').eq('id', userId).maybeSingle();
          if (alunoData) {
            foto = alunoData.foto_url || alunoData.foto || (alunoData.dados as any)?.foto || (alunoData.dados as any)?.fotoUrl || (alunoData.dados as any)?.foto_url;
          }
        } catch (e) {}
      }

      // Check responsaveis table if not found
      if (!foto && userId) {
        try {
          const { data: respData } = await supabase.from('responsaveis').select('foto, foto_url, dados').eq('id', userId).maybeSingle();
          if (respData) {
            foto = respData.foto_url || respData.foto || (respData.dados as any)?.foto || (respData.dados as any)?.fotoUrl || (respData.dados as any)?.foto_url;
          }
        } catch (e) {}
      }

      // API Fallback for users not in system_users, alunos, or responsaveis (e.g. Master Admin or missing RLS)
      if (!foto && userId) {
        try {
          const res = await fetch(`/api/user-photo?id=${userId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.foto) foto = json.foto;
          }
        } catch (e) {}
      }

      // URL Optimization removed: Supabase Free tier doesn't support width/height query params
      // and it causes a 400 Bad Request error.

      if (foto) {
        photoCache[cacheKey] = foto;
        if (userId) {
          photoCache[userId] = foto;
          try {
            localStorage.setItem(`edu-profile-extra-${userId}`, JSON.stringify({ foto }));
          } catch (e) {}
        }
        if (name) {
          photoCache[`name:${name}`] = foto;
          try {
            localStorage.setItem(`edu-profile-extra-name-${name}`, JSON.stringify({ foto }));
          } catch (e) {}
        }
        return foto;
      }
    } catch (err) {
      console.error('Error fetching user photo:', err);
    }
    photoCache[cacheKey] = null;
    return null;
  })();

  pendingPromises[cacheKey] = promise;
  return promise;
}

export function UserAvatar({ 
  userId, 
  name, 
  fotoUrl,
  size = 44,
  className = "",
  style = {}
}: { 
  userId?: string, 
  name: string, 
  fotoUrl?: string | null,
  size?: number,
  className?: string,
  style?: React.CSSProperties
}) {
  const [foto, setFoto] = useState(fotoUrl || '');

  useEffect(() => {
    // Se recebeu uma fotoUrl explicitamente, usa ela
    if (fotoUrl && fotoUrl !== 'undefined') {
      setFoto(fotoUrl);
      return;
    }
    
    // Check local caches
    let foundLocal = false;
    const cacheKey = userId || `name:${name}`;
    
    // Helper to sanitize broken Supabase URLs from cache
    const sanitizeUrl = (url: string) => {
      if (!url) return url;
      if (url.includes('/storage/v1/object/public/')) {
        try {
          const urlObj = new URL(url);
          urlObj.searchParams.delete('width');
          urlObj.searchParams.delete('height');
          return urlObj.toString();
        } catch (e) { return url; }
      }
      return url;
    };
    
    if (photoCache[cacheKey]) {
      setFoto(sanitizeUrl(photoCache[cacheKey]!));
      foundLocal = true;
    } else {
      try {
        const storageKey = userId ? `edu-profile-extra-${userId}` : `edu-profile-extra-name-${name}`;
        const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (data && data.foto) {
          const safeFoto = sanitizeUrl(data.foto);
          setFoto(safeFoto);
          photoCache[cacheKey] = safeFoto;
          if (userId) photoCache[userId] = safeFoto;
          if (name) photoCache[`name:${name}`] = safeFoto;
          foundLocal = true;
        }
      } catch (e) {}
    }

    // Call fallback db fetch
    fetchUserPhoto(userId, name).then((resolvedFoto) => {
      if (resolvedFoto) {
        setFoto(sanitizeUrl(resolvedFoto));
      }
    });
  }, [userId, name, fotoUrl]);

  if (foto && foto !== 'undefined') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img 
        src={foto} 
        alt={name} 
        loading="lazy"
        className={className}
        style={{ 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          objectFit: 'cover',
          flexShrink: 0,
          ...style 
        }} 
      />
    );
  }

  const colors = [
    'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', // Indigo
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', // Violet
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Pink
    'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', // Rose
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
    'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
  ];

  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const initials = name ? name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('') : '?';
  const bgColor = colors[getHash(name || 'User') % colors.length];

  return (
    <div 
      className={`avatar ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        background: bgColor, 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontWeight: 800, 
        fontSize: size * 0.4,
        flexShrink: 0,
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        ...style 
      }}
    >
      {initials}
    </div>
  );
}

