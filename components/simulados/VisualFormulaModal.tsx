'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Z_INDEX } from '@/lib/zIndex';

export function VisualFormulaModal({ 
  open, 
  onClose, 
  onSave 
}: { 
  open: boolean; 
  onClose: () => void;
  onSave: (latex: string) => void;
}) {
  const mfRef = useRef<any>(null);
  const [value, setValue] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setValue('');
      if (mfRef.current) mfRef.current.value = '';
      
      import('mathlive').then(() => {
        const keyboard = (window as any).mathVirtualKeyboard;
        if (keyboard) {
          keyboard.layouts = ['numeric', 'symbols', 'alphabetic', 'greek'];
        }
      });
    }
  }, [open]);

  useEffect(() => {
    const handleInput = (e: Event) => {
      setValue((e.target as any).value);
    };
    
    const mf = mfRef.current;
    if (mf) {
      mf.addEventListener('input', handleInput);
      return () => mf.removeEventListener('input', handleInput);
    }
  }, [open]);

  const handleSave = () => {
    if (mfRef.current) {
      let rawLatex = mfRef.current.value;
      // MathLive uses \placeholder{} which KaTeX doesn't understand. 
      // Replace it with \square to show an empty box, or just remove it.
      // Mathlive sometimes outputs \placeholder[id]{} or just \placeholder{}
      let cleanLatex = rawLatex.replace(/\\placeholder(\[[^\]]*\])?(\{[^}]*\})?/g, '\\square ');
      onSave(cleanLatex);
    }
    onClose();
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .math-keyboard-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483640; /* Max z-index - 7 */
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease-out forwards;
        }
        .math-keyboard-container {
          position: fixed;
          z-index: 2147483647; /* Absolute maximum z-index */
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        /* Mobile: Bottom Sheet */
        @media (max-width: 767px) {
          .math-keyboard-container {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            border-radius: 20px 20px 0 0;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
        /* Desktop: Centered Window */
        @media (min-width: 768px) {
          .math-keyboard-container {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            max-width: 800px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            animation: fadeIn 0.3s ease-out forwards;
          }
        }
        
        /* OVERRIDE MATHLIVE VIRTUAL KEYBOARD Z-INDEX GLOBALLY */
        :root {
          --keyboard-zindex: 2147483647 !important;
        }
        math-virtual-keyboard, 
        .ML__keyboard, 
        div[part="keyboard"] {
          z-index: 2147483647 !important;
        }
      `}</style>
      
      {/* Overlay */}
      <div className="math-keyboard-overlay" onClick={onClose}></div>
      
      {/* Keyboard Modal */}
      <div className="math-keyboard-container">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800" style={{ color: '#1e293b' }}>Teclado Visual Matemático</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2" style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="p-4 md:p-6 flex flex-col items-center justify-center bg-gray-50/50" style={{ backgroundColor: '#f8fafc' }}>
          {React.createElement('math-field', {
            ref: mfRef,
            style: { 
              fontSize: '28px', 
              width: '100%', 
              padding: '16px', 
              minHeight: '80px',
              border: '2px solid #cbd5e1', 
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              outline: 'none',
              color: '#0f172a',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
            }
          })}
          <p className="text-xs md:text-sm text-gray-500 mt-4 text-center" style={{ color: '#64748b' }}>
            Clique no campo acima e use o <strong>ícone azul de teclado</strong> no canto direito para montar a sua fórmula.
          </p>
        </div>
        
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-3" style={{ backgroundColor: '#ffffff' }}>
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            style={{ border: '1px solid #cbd5e1', cursor: 'pointer', borderRadius: '8px' }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            style={{ backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', border: 'none', borderRadius: '8px' }}
          >
            Inserir Fórmula
          </button>
        </div>
      </div>
    </>
  );

  const root = document.getElementById('global-overlay-root') || document.body;
  return require('react-dom').createPortal(modalContent, root);
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
