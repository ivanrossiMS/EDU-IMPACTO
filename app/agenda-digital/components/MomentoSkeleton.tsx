import React from 'react';
import { motion } from 'framer-motion';

export function MomentoSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, padding: '24px 16px', width: '100%' }}>
      {Array.from({ length: count }).map((_, idx) => {
        const initialRotation = ((idx * 3) % 5) - 2;
        return (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="polaroid-card"
            style={{ 
              transform: `rotate(${initialRotation}deg)`, 
              width: '100%', 
              maxWidth: 480, 
              background: '#ffffff', 
              padding: '18px 18px 24px 18px', 
              borderRadius: 16, 
              border: '1px solid rgba(255, 255, 255, 0.9)', 
              boxShadow: '0 20px 45px rgba(0,0,0,0.07)' 
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: '40%', height: 14, background: '#e2e8f0', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
                <div style={{ width: '60%', height: 10, background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
              </div>
            </div>

            {/* Media Box */}
            <div style={{ width: '100%', aspectRatio: '1/1', background: '#e2e8f0', borderRadius: 12, marginBottom: 16, animation: 'pulse 1.5s infinite' }} />

            {/* Footer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px' }}>
               <div style={{ width: '80%', height: 16, background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
               <div style={{ width: '50%', height: 16, background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
               <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                 <div style={{ width: 40, height: 20, background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                 <div style={{ width: 40, height: 20, background: '#e2e8f0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
               </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
