import re

with open('components/simulados/PageContent.tsx', 'r') as f:
    content = f.read()

# We don't want to mess up the file. Let's just do a string replacement for the two specific sections.

# Section 1: part_alts_container
part1_start = content.find("                    return block.q.simulados_alternativas?.map((a: any) => {")
part1_end = content.find("                  })()}", part1_start)

part1_replacement = """                    return block.q.simulados_alternativas?.map((a: any) => {
                      const urlParts = a.imagem_url ? a.imagem_url.split('#w=') : [];
                      const imgBaseUrl = urlParts[0];
                      const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                      const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                      const effectiveWidth = imgWidth || maxImgWidth;
                      const qId = block.q.id;

                      return (
                        <div key={a.id} className="alt-hover-group" style={{ 
                          display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative',
                          flex: effectiveWidth ? '0 0 auto' : '1 1 200px'
                        }}>
                          <div className={a.eh_correta ? 'correct-bubble-preview' : ''} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                            border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                          }}>
                            {a.letra}
                          </div>
                          <div style={{ flex: 1, position: 'relative', maxWidth: effectiveWidth ? `${effectiveWidth}px` : '100%' }}>
                            {a.imagem_url && (
                              <div style={{ position: 'relative', marginBottom: 8, width: '100%', maxWidth: '100%' }}>
                                <img src={imgBaseUrl} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                {onEditAlternativaImage && (
                                  <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                    <button onClick={() => onEditAlternativaImage(qId, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 350}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aumentar"><ZoomIn size={12} /></button>
                                    <button onClick={() => onEditAlternativaImage(qId, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 250}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Diminuir"><ZoomOut size={12} /></button>
                                    <button onClick={() => onEditAlternativaImage(qId, a.id, '')} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </div>
                            )}
                            <HtmlContent editable={true} html={a.texto} onBlurHtml={(newHtml) => { onEditAlternativa(qId, a.id, newHtml); forceRepaginate(); }} style={{ wordBreak: 'break-word', outline: 'none' }} />
                            {onEditAlternativaImage && (
                              <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                <button onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Imagem</button>
                                {imgMenuOpen === a.id && (
                                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                    <button onClick={() => handleImageAction(qId, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                                    <button onClick={() => handleImageAction(qId, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {onRemoveAlternativa && (
                            <button className="no-print alt-delete-btn" onClick={() => { onRemoveAlternativa(qId, a.id); forceRepaginate(); }} title="Remover alternativa" style={{ position: 'absolute', right: -30, top: 4, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 20, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
                          )}
                        </div>
                      );
                    });
"""

content = content[:part1_start] + part1_replacement + content[part1_end:]

# Section 2: part_alt
part2_start = content.find("                      <div style={{ flex: 1, position: 'relative' }}>\n                        {(() => {\n                          const imgWidths = q.simulados_alternativas")
part2_end = content.find("                      <button\n                        className=\"no-print alt-delete-btn\"", part2_start)

if part2_end == -1:
    print("Could not find part2_end")

part2_replacement = """                      <div style={{ flex: 1, position: 'relative' }}>
                        {(() => {
                          const imgWidths = q.simulados_alternativas
                            ?.filter((altInfo: any) => altInfo.imagem_url)
                            .map((altInfo: any) => {
                              const parts = altInfo.imagem_url.split('#w=');
                              return parts.length > 1 ? parseInt(parts[1]) : 250;
                            }) || [];
                          const maxImgWidth = imgWidths.length > 0 ? Math.max(...imgWidths) : null;
                          
                          const urlParts = a.imagem_url ? a.imagem_url.split('#w=') : [];
                          const imgBaseUrl = urlParts[0];
                          const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                          const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                          const effectiveWidth = imgWidth || maxImgWidth;

                          return (
                            <div style={{ maxWidth: effectiveWidth ? `${effectiveWidth}px` : '100%' }}>
                              {a.imagem_url && (
                                <div style={{ position: 'relative', marginBottom: 8, width: '100%', maxWidth: '100%' }}>
                                  <img src={imgBaseUrl} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                                  {onEditAlternativaImage && (
                                    <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                      <button onClick={() => onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 350}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aumentar"><ZoomIn size={12} /></button>
                                      <button onClick={() => onEditAlternativaImage(q.id, a.id, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 250}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Diminuir"><ZoomOut size={12} /></button>
                                      <button onClick={() => onEditAlternativaImage(q.id, a.id, '')} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover"><Trash2 size={12} /></button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <HtmlContent 
                                editable={true}
                                html={a.texto}
                                onBlurHtml={(newHtml) => { onEditAlternativa(q.id, a.id, newHtml); forceRepaginate(); }}
                                style={{ outline: 'none', border: '1px dashed transparent', padding: '0 4px', wordBreak: 'break-word', cursor: 'text' }}
                              />
                              {onEditAlternativaImage && (
                                <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: imgMenuOpen === a.id ? 1 : undefined, pointerEvents: imgMenuOpen === a.id ? 'auto' : undefined }}>
                                  <button onClick={() => setImgMenuOpen(imgMenuOpen === a.id ? null : a.id)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Imagem</button>
                                  {imgMenuOpen === a.id && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                                      <button onClick={() => handleImageAction(q.id, a.id, 'upload', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                                      <button onClick={() => handleImageAction(q.id, a.id, 'ai', a.texto)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
"""

content = content[:part2_start] + part2_replacement + content[part2_end:]

with open('components/simulados/PageContent.tsx', 'w') as f:
    f.write(content)
print("done")
