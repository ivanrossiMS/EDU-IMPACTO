import React from 'react';
import { X, BookOpen } from 'lucide-react';

export function PageContent({ 
  page, 
  pIndex, 
  fontSize, 
  config, 
  simulado, 
  onEditEnunciado, 
  onEditAlternativa, 
  onRemoveAlternativa, 
  onToggleQuestion, 
  forceRepaginate 
}: any) {
  return (
    <>
      <style>{`
        @media screen {
          .correct-bubble-preview {
            background-color: #22c55e !important;
            color: #ffffff !important;
            border-color: #22c55e !important;
          }
        }
      `}</style>
      {pIndex === 0 && config?.modelo_pdf_url && (
        <div className="print-cover-image" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={config.modelo_pdf_url} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}
      {pIndex > 0 && config?.modelo_pdf_outras_paginas_url && (
        <div className="print-repeating-bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', margin: 0, padding: 0 }}>
          <img src={config.modelo_pdf_outras_paginas_url} alt="Fundo Interna" style={{ width: '100%', height: '100%', objectFit: 'fill', margin: 0, padding: 0, display: 'block' }} />
        </div>
      )}

      {pIndex === 0 && config?.modelo_pdf_url && (
        <div className="simulado-title" style={{
          position: 'absolute', top: '20mm', right: '25mm', width: '75mm', height: '24mm',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          fontWeight: 900, fontSize: '13pt', color: '#1e293b', zIndex: 3
        }}>
          {simulado.titulo}
        </div>
      )}

      <div style={{ 
        position: 'absolute', 
        top: pIndex === 0 ? '75mm' : '18mm', 
        left: '16mm', right: '16mm', bottom: '18mm', 
        zIndex: 2,
        display: 'flex',
        gap: 0
      }}>
        {page.map((col: any[], cIndex: number) => (
          <React.Fragment key={`col-${cIndex}`}>
            {cIndex > 0 && (
              <div style={{
                width: '1px',
                background: 'linear-gradient(to bottom, rgba(59,130,246,0) 0%, rgba(59,130,246,0.3) 15%, rgba(59,130,246,0.3) 85%, rgba(59,130,246,0) 100%)',
                alignSelf: 'stretch',
                margin: '0'
              }} />
            )}
            <div style={{ 
              flex: 1, 
              fontSize: `${fontSize}px`, 
              lineHeight: 1.6, 
              color: '#000', 
              textAlign: 'justify',
              paddingLeft: cIndex > 0 ? '6mm' : 0,
              paddingRight: cIndex < page.length - 1 ? '6mm' : 0
            }}>
            {col.map((block: any, bIndex: number) => {
              
              if (block.type === 'part_disciplina') {
                return (
                  <div 
                    key={`b-${bIndex}`}
                    style={{
                      marginTop: block.renderMarginTop || 0,
                      marginBottom: 16,
                      padding: '8px 16px',
                      borderLeft: '4px solid #3b82f6',
                      background: 'linear-gradient(90deg, #e0f2fe 0%, #f8fafc 100%)',
                      borderRadius: '0 8px 8px 0',
                      fontWeight: 800,
                      fontSize: '11pt',
                      color: '#1e293b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      breakInside: 'avoid'
                    }}
                  >
                    <BookOpen size={16} color="#3b82f6" style={{ marginTop: '-1px' }} />
                    {block.discName}
                  </div>
                );
              }

              if (block.type === 'full') {
                const q = block.q;
                return (
                  <div key={`b-${bIndex}`} className="questao-container" style={{ position: 'relative', marginTop: block.renderMarginTop || 0, breakInside: 'avoid' }}>
                    {/* Controles Overlay (No Print) */}
                    <div className="no-print" style={{ position: 'absolute', right: -10, top: -10, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'white', padding: '6px 10px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={true}
                          onChange={() => onToggleQuestion(q.id)}
                          style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                        />
                        Incluir
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                        fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                      }}>
                        {block.qIndex + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div 
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            onEditEnunciado(q.id, e.currentTarget.innerHTML);
                            forceRepaginate();
                          }}
                          dangerouslySetInnerHTML={{ __html: q.enunciado }}
                          style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', marginBottom: 12, wordBreak: 'break-word', cursor: 'text' }}
                        />
                        {q.imagens?.map((img: string, i: number) => (
                          <img key={i} src={img} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: 12, display: 'block' }} />
                        ))}
                        {q.simulados_alternativas?.map((a: any) => (
                          <div key={a.id} className="alt-hover-group" style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start', position: 'relative' }}>
                            <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                              border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                            }}>
                              {a.letra}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div 
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  onEditAlternativa(q.id, a.id, e.currentTarget.innerHTML);
                                  forceRepaginate();
                                }}
                                dangerouslySetInnerHTML={{ __html: a.texto }}
                                style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                              />
                            </div>
                            <button
                              className="no-print alt-delete-btn"
                              onClick={() => {
                                onRemoveAlternativa(q.id, a.id);
                                forceRepaginate();
                              }}
                              style={{ position: 'absolute', right: -30, top: 4, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 20, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              title="Remover alternativa"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_enunciado') {
                const q = block.q;
                return (
                  <div key={`b-${bIndex}`} style={{ position: 'relative', marginTop: block.renderMarginTop || 0, display: 'flex', gap: 10 }}>
                    {/* Controles Overlay (No Print) */}
                    <div className="no-print" style={{ position: 'absolute', right: -10, top: -10, display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'white', padding: '6px 10px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={true}
                          onChange={() => onToggleQuestion(q.id)}
                          style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                        />
                        Incluir
                      </label>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', minWidth: '28px', backgroundColor: '#1e293b', color: '#ffffff',
                      fontWeight: 900, borderRadius: '8px', fontSize: '11pt', marginTop: '4px'
                    }}>
                      {block.qIndex + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          onEditEnunciado(q.id, e.currentTarget.innerHTML);
                          forceRepaginate();
                        }}
                        dangerouslySetInnerHTML={{ __html: q.enunciado }}
                        style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                      />
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_img') {
                return (
                  <div key={`b-${bIndex}`} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div style={{ flex: 1 }}>
                       <img src={block.imgUrl} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                    </div>
                  </div>
                );
              }

              if (block.type === 'part_alt') {
                const q = block.q;
                const a = block.alt;
                return (
                  <div key={`b-${bIndex}`} className="alt-hover-group" style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
                      <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                        border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                      }}>
                        {a.letra}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div 
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            onEditAlternativa(q.id, a.id, e.currentTarget.innerHTML);
                            forceRepaginate();
                          }}
                          dangerouslySetInnerHTML={{ __html: a.texto }}
                          style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                        />
                      </div>
                      <button
                        className="no-print alt-delete-btn"
                        onClick={() => {
                          onRemoveAlternativa(q.id, a.id);
                          forceRepaginate();
                        }}
                        style={{ position: 'absolute', right: -30, top: 4, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 20, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Remover alternativa"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
