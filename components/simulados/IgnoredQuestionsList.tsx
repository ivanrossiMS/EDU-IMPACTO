import React from 'react';
import { EyeOff } from 'lucide-react';

export function IgnoredQuestionsList({ questoes, onToggle }: { questoes: any[], onToggle: (id: string) => void }) {
  if (!questoes || questoes.length === 0) return null;

  return (
    <div className="no-print" style={{ width: '210mm', marginTop: 40, background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
        <EyeOff size={24} color="#64748b" />
        <h2 style={{ margin: 0, fontSize: 18, color: '#334155', fontWeight: 700 }}>Questões Ignoradas ({questoes.length})</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questoes.map(q => (
          <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
            <div style={{ flex: 1, color: '#64748b', fontSize: 14 }}>
              <div dangerouslySetInnerHTML={{ __html: q.enunciado }} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />
            </div>
            <button
              onClick={() => onToggle(q.id)}
              style={{ padding: '8px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, color: '#3b82f6', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              Incluir Novamente
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
