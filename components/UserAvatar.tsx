import React, { useEffect, useState } from 'react';

export function UserAvatar({ 
  userId, 
  name, 
  size = 44,
  className = "",
  style = {}
}: { 
  userId?: string, 
  name: string, 
  size?: number,
  className?: string,
  style?: React.CSSProperties
}) {
  const [foto, setFoto] = useState('');

  useEffect(() => {
    if (!userId) return;
    try {
      const data = JSON.parse(localStorage.getItem(`edu-profile-extra-${userId}`) || 'null');
      if (data && data.foto) {
        setFoto(data.foto);
      }
    } catch {}
  }, [userId]);

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

  const initials = name ? name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('') : 'U';

  return (
    <div 
      className={`avatar ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        background: 'hsl(var(--primary))', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontWeight: 800, 
        fontSize: size * 0.4,
        flexShrink: 0,
        ...style 
      }}
    >
      {initials}
    </div>
  );
}
