'use client';

import { Bell } from 'lucide-react';
import { useAgendaNotifications } from '../../hooks/useAgendaNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function FloatingNotificationBadge() {
  const { unreadCount, recentNotifications, markAllAsRead, markAsRead } = useAgendaNotifications();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (unreadCount === 0 && !isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 99999,
            }}
          >
            <button
              onClick={() => setIsOpen(true)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4), 0 0 0 4px rgba(255, 255, 255, 0.8)',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Bell size={24} color="#fff" />
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              height: 24,
              minWidth: 24,
              padding: '0 6px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)',
              border: '2px solid #fff'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
          
          {/* Ripple Pulse Effect */}
          <div 
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              background: 'transparent',
              border: '2px solid #ef4444',
              animation: 'pulseGlow 2s infinite',
              pointerEvents: 'none'
            }}
          />
        </button>
      </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999998,
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'none'
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              style={{
                position: 'fixed',
                bottom: 100,
                right: 24,
                width: 380,
                maxHeight: '70vh',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'none',
                borderRadius: 24,
                boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.05)',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15, 23, 42, 0.05)' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Notificações</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Marcar como lidas
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>

              <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
                {recentNotifications.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <Bell size={32} style={{ opacity: 0.2, margin: '0 auto 12px auto' }} />
                    <div style={{ fontWeight: 600 }}>Nenhuma novidade</div>
                    <div style={{ fontSize: 13 }}>Você está atualizado!</div>
                  </div>
                ) : (
                  recentNotifications.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id);
                        router.push(notif.link);
                        setIsOpen(false);
                      }}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        background: notif.read ? 'transparent' : 'rgba(79, 70, 229, 0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 16,
                        alignItems: 'flex-start',
                        transition: 'background 0.2s',
                        marginBottom: 8
                      }}
                    >
                      <div style={{ 
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: notif.read ? '#f1f5f9' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: notif.read ? '#94a3b8' : '#fff'
                      }}>
                        <Bell size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{notif.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {new Date(notif.createdAt).toLocaleDateString('pt-BR')} às {new Date(notif.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                      {!notif.read && (
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444', marginTop: 6, flexShrink: 0 }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
