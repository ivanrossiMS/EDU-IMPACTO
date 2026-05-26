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
      let query = supabase.from('system_users').select('dados');
      
      if (userId) {
        if (isValidUuid(userId)) {
          query = query.or(`id.eq."${userId}",auth_id.eq."${userId}"`);
        } else {
          query = query.eq('id', userId);
        }
      } else if (name) {
        query = query.eq('nome', name);
      } else {
        return null;
      }

      const { data, error } = await query.maybeSingle();

      let foto = null;

      if (data && data.dados && typeof data.dados === 'object') {
        foto = (data.dados as any).foto || (data.dados as any).fotoUrl;
      }

      // API Fallback for users not in system_users (e.g. Master Admin)
      if (!foto && userId && isValidUuid(userId)) {
        try {
          const res = await fetch(`/api/user-photo?id=${userId}`);
          if (res.ok) {
            const json = await res.json();
            if (json.foto) foto = json.foto;
          }
        } catch (e) {}
      }

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
    
    if (photoCache[cacheKey]) {
      setFoto(photoCache[cacheKey]!);
      foundLocal = true;
    } else {
      try {
        const storageKey = userId ? `edu-profile-extra-${userId}` : `edu-profile-extra-name-${name}`;
        const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (data && data.foto) {
          setFoto(data.foto);
          photoCache[cacheKey] = data.foto;
          if (userId) photoCache[userId] = data.foto;
          if (name) photoCache[`name:${name}`] = data.foto;
          foundLocal = true;
        }
      } catch (e) {}
    }

    // Call fallback db fetch
    fetchUserPhoto(userId, name).then((resolvedFoto) => {
      if (resolvedFoto) {
        setFoto(resolvedFoto);
      }
    });
  }, [userId, name, fotoUrl]);

  if (foto && foto !== 'undefined') {
    return (
      <Image 
        src={foto} 
        alt={name} 
        width={size}
        height={size}
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

