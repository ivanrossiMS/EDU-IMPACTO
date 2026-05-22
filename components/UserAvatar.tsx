import React, { useEffect, useState } from 'react';

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
    if (fotoUrl) {
      setFoto(fotoUrl);
      return;
    }
    
    // Fallback: carregar do localStorage extra
    if (!userId) return;

    try {
      const storageKey = `edu-profile-extra-${userId}`;
      const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (data && data.foto) {
        setFoto(data.foto);
      }
    } catch (e) {}
  }, [userId, fotoUrl]);

  if (foto) {
    return (
      <img 
        src={foto} 
        alt={name} 
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
