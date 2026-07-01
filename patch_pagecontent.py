import os
import re

file_path = "components/simulados/PageContent.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add Lucide imports
imports_old = "import { X, BookOpen } from 'lucide-react';"
imports_new = "import { X, BookOpen, ImageIcon, Sparkles, Upload, Trash2 } from 'lucide-react';\nimport { useState } from 'react';"
content = content.replace(imports_old, imports_new)

# Add props
props_old = """  isEditHeaderMode,
  headerLayout,
  onUpdateHeaderField,
  pageA4Ref
}: any) {"""
props_new = """  isEditHeaderMode,
  headerLayout,
  onUpdateHeaderField,
  pageA4Ref,
  alternativasLayout = 'vertical',
  onEditAlternativaImage
}: any) {
  const [imgMenuOpen, setImgMenuOpen] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleImageAction = async (qId: string, altId: string, action: 'upload' | 'ai', altText: string) => {
    setImgMenuOpen(null);
    if (!onEditAlternativaImage) return;

    if (action === 'ai') {
      setIsGenerating(true);
      try {
        const res = await fetch('/api/ai/gerar-imagem', {
          method: 'POST', body: JSON.stringify({ enunciado: altText, disciplina: 'Geral' }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.base64Image) {
          onEditAlternativaImage(qId, altId, data.base64Image);
        } else {
          alert('Erro ao gerar imagem por IA.');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao gerar imagem por IA.');
      }
      setIsGenerating(false);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as any).files[0];
        if (!file) return;
        setIsGenerating(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/upload-midia', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) onEditAlternativaImage(qId, altId, data.url);
        } catch (err) {
          console.error(err);
        }
        setIsGenerating(false);
      };
      input.click();
    }
  };"""
content = content.replace(props_old, props_new)

# Add CSS for image buttons
css_old = """.correct-bubble-preview {
            background-color: #22c55e !important;
            color: #ffffff !important;
            border-color: #22c55e !important;
          }"""
css_new = """.correct-bubble-preview {
            background-color: #22c55e !important;
            color: #ffffff !important;
            border-color: #22c55e !important;
          }
          
          .alt-hover-group .alt-img-actions {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
          }
          .alt-hover-group:hover .alt-img-actions {
            opacity: 1;
            pointer-events: auto;
          }"""
content = content.replace(css_old, css_new)

# Update alternative rendering inside 'full' map
alt_render_old = """                        {q.simulados_alternativas?.map((a: any) => (
                          <div key={a.id} className="alt-hover-group" style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start', position: 'relative' }}>
                            <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                              border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                            }}>
                              {a.letra}
                            </div>
                            <div style={{ flex: 1 }}>
                              <HtmlContent 
                                editable={true}
                                html={a.texto}
                                onBlurHtml={(newHtml) => {
                                  onEditAlternativa(q.id, a.id, newHtml);
                                  forceRepaginate();
                                }}
                                style={{ wordBreak: 'break-word', outline: 'none' }}
                              />
                            </div>
                            {onRemoveAlternativa && (
                              <button
                                className="no-print alt-action-btn"
                                onClick={() => {
                                  onRemoveAlternativa(q.id, a.id);
                                  forceRepaginate();
                                }}
                                title="Remover Alternativa"
                                style={{
                                  position: 'absolute',
                                  right: -16,
                                  top: 0,
                                  border: 'none',
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}"""
alt_render_new = """                        <div style={alternativasLayout === 'horizontal' ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 } : {}}>
                          {q.simulados_alternativas?.map((a: any) => (
                            <div key={a.id} className="alt-hover-group" style={{ display: 'flex', gap: 12, marginTop: alternativasLayout === 'vertical' ? 12 : 0, alignItems: 'flex-start', position: 'relative' }}>
                              <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                                border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                              }}>
                                {a.letra}
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                {a.imagem_url && (
                                  <div style={{ position: 'relative', marginBottom: 8 }}>
                                    <img src={a.imagem_url} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                    {onEditAlternativaImage && (
                                      <button
                                        className="no-print alt-img-actions"
                                        onClick={() => onEditAlternativaImage(q.id, a.id, '')}
                                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                )}
                                
                                <HtmlContent 
                                  editable={true}
                                  html={a.texto}
                                  onBlurHtml={(newHtml) => {
                                    onEditAlternativa(q.id, a.id, newHtml);
                                    forceRepaginate();
                                  }}
                                  style={{ wordBreak: 'break-word', outline: 'none' }}
                                />

                                {onEditAlternativaImage && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10 }}>
                                    <button 
                                      onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)}
                                      style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
                                    >
                                      <ImageIcon size={12} /> Imagem
                                    </button>
                                    {imgMenuOpen === a.id && (
                                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                        <button onClick={() => handleImageAction(q.id, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}>
                                          <Upload size={14} /> Fazer Upload
                                        </button>
                                        <button onClick={() => handleImageAction(q.id, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}>
                                          <Sparkles size={14} /> Gerar com IA
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {onRemoveAlternativa && (
                                <button
                                  className="no-print alt-action-btn"
                                  onClick={() => {
                                    onRemoveAlternativa(q.id, a.id);
                                    forceRepaginate();
                                  }}
                                  title="Remover Alternativa"
                                  style={{
                                    position: 'absolute',
                                    right: -16,
                                    top: 0,
                                    border: 'none',
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>"""
content = content.replace(alt_render_old, alt_render_new)

# Also update part_alt mapping if it exists
part_alt_old = """            return (
              <div key={idx} style={{ padding: '0 40px', marginTop: block.renderMarginTop }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className={block.alt.eh_correta ? 'correct-bubble-preview' : ''} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                    border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                  }}>
                    {block.alt.letra}
                  </div>
                  <div style={{ flex: 1 }}>
                    <HtmlContent html={block.alt.texto} style={{ wordBreak: 'break-word' }} />
                  </div>
                </div>
              </div>
            );"""
part_alt_new = """            return (
              <div key={idx} style={{ padding: '0 40px', marginTop: block.renderMarginTop }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className={block.alt.eh_correta ? 'correct-bubble-preview' : ''} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                    border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                  }}>
                    {block.alt.letra}
                  </div>
                  <div style={{ flex: 1 }}>
                    {block.alt.imagem_url && <img src={block.alt.imagem_url} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />}
                    <HtmlContent html={block.alt.texto} style={{ wordBreak: 'break-word' }} />
                  </div>
                </div>
              </div>
            );"""
content = content.replace(part_alt_old, part_alt_new)

# And part_alts_container (newly introduced for horizontal layouts when spanning columns)
alts_container_render = """          if (block.type === 'part_alts_container') {
            return (
              <div key={idx} style={{ padding: '0 40px', marginTop: block.renderMarginTop }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {block.q.simulados_alternativas?.map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                        border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                      }}>
                        {a.letra}
                      </div>
                      <div style={{ flex: 1 }}>
                        {a.imagem_url && <img src={a.imagem_url} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginBottom: 8, display: 'block' }} />}
                        <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }"""

# Insert part_alts_container check before part_alt
content = content.replace("          if (block.type === 'part_alt') {", alts_container_render + "\n\n          if (block.type === 'part_alt') {")

# Add generating overlay
overlay = """      {isGenerating && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px 40px', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Sparkles size={32} color="#8b5cf6" className="animate-pulse" />
            <span style={{ fontWeight: 700, color: '#334155' }}>Gerando imagem ilustrativa...</span>
          </div>
        </div>
      )}
    </>
  );"""
content = content.replace("    </>\n  );", overlay)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("PageContent patched successfully!")
