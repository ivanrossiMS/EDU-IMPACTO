'use client';

import { useAgendaNotifications } from '../../hooks/useAgendaNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AgendaNotificationCenter() {
  const { unreadCount, recentNotifications, markAllAsRead, markAsRead } = useAgendaNotifications();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          cursor: 'pointer'
        }}
      >
        <Bell size={20} color="#0f172a" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #fff'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </button>

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
                background: 'rgba(15, 23, 42, 0.2)',
                backdropFilter: 'blur(4px)'
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: 80,
                right: 24,
                width: 380,
                maxHeight: '80vh',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
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
                      Marcar todas como lidas
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
                {recentNotifications.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <Bell size={32} style={{ opacity: 0.2, margin: '0 auto 12px auto' }} />
                    <div style={{ fontWeight: 600 }}>Nenhuma novidade</div>
                    <div style={{ fontSize: 13 }}>Tudo limpo por aqui!</div>
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
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ 
                        width: 40, height: 40, borderRadius: 12, 
                        background: notif.read ? '#f1f5f9' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: notif.read ? '#94a3b8' : '#fff'
                      }}>
                        {notif.type === 'comunicado' && <Bell size={18} />}
                        {notif.type !== 'comunicado' && <ExternalLink size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{notif.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {new Date(notif.createdAt).toLocaleDateString('pt-BR')} às {new Date(notif.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                      {!notif.read && (
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: '#ef4444', marginTop: 6 }} />
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
