import React from 'react';
import { motion } from 'framer-motion';

export function ComunicadoSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <motion.div 
          key={idx} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          style={{ display: 'flex', position: 'relative', paddingBottom: 12, width: '100%' }}
        >
          {/* Timeline - Desktop */}
          <div className="ad-desktop-only" style={{ marginRight: 32, paddingTop: 24, width: 88 }}>
            <div style={{ width: 72, textAlign: 'right', paddingRight: 16 }}>
              <div style={{ width: 40, height: 24, background: '#e2e8f0', borderRadius: 6, marginLeft: 'auto', marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
              <div style={{ width: 30, height: 12, background: '#e2e8f0', borderRadius: 4, marginLeft: 'auto', animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
          
          {/* Timeline - Mobile */}
          <div className="ad-mobile-only" style={{ marginRight: 8, paddingTop: 12, width: 36 }}>
            <div style={{ width: 36, textAlign: 'right', paddingRight: 8 }}>
              <div style={{ width: 20, height: 14, background: '#e2e8f0', borderRadius: 4, marginLeft: 'auto', marginBottom: 4, animation: 'pulse 1.5s infinite' }} />
              <div style={{ width: 16, height: 8, background: '#e2e8f0', borderRadius: 2, marginLeft: 'auto', animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>

          <div className="card ad-feed-card" style={{ flex: 1, padding: '24px 28px', borderRadius: 24, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: 16 }}>
            <div style={{ width: 62, height: 62, borderRadius: 16, background: '#e2e8f0', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: '60%', height: 20, background: '#e2e8f0', borderRadius: 6, marginBottom: 12, animation: 'pulse 1.5s infinite' }} />
              <div style={{ width: '40%', height: 14, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}
