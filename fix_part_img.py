import re

with open('components/simulados/PageContent.tsx', 'r') as f:
    content = f.read()

part_img_start = content.find("if (block.type === 'part_img') {")
part_img_end = content.find("if (block.type === 'part_alts_container') {")

replacement = """              if (block.type === 'part_img') {
                const q = block.q;
                const i = block.imgIndex;
                const img = block.imgUrl;
                const urlParts = img.split('#w=');
                const imgBaseUrl = urlParts[0];
                const imgWidthStr = urlParts.length > 1 ? urlParts[1] : null;
                const imgWidth = imgWidthStr ? parseInt(imgWidthStr) : null;
                const menuKey = `${q.id}-img-${i}`;

                return (
                  <div key={`b-${bIndex}`} style={{ display: 'flex', gap: 10, marginTop: block.renderMarginTop || 0 }}>
                    <div style={{ width: '28px', minWidth: '28px' }}></div>
                    <div className="alt-hover-group" style={{ flex: 1, position: 'relative', width: imgWidth ? `${imgWidth}px` : '100%', maxWidth: '100%' }}>
                      <img src={imgBaseUrl} style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
                      
                      {onEditEnunciadoImage && (
                        <div className="no-print alt-img-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                          <button onClick={() => onEditEnunciadoImage(q.id, i, `${imgBaseUrl}#w=${imgWidth ? Math.min(800, imgWidth + 50) : 400}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Aumentar"><ZoomIn size={12} /></button>
                          <button onClick={() => onEditEnunciadoImage(q.id, i, `${imgBaseUrl}#w=${imgWidth ? Math.max(100, imgWidth - 50) : 300}`)} style={{ background: 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Diminuir"><ZoomOut size={12} /></button>
                          <button onClick={() => onEditEnunciadoImage(q.id, i, '')} style={{ background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Remover"><Trash2 size={12} /></button>
                        </div>
                      )}
                      
                      {onEditEnunciadoImage && (
                        <div className="no-print alt-img-actions" style={{ position: 'absolute', bottom: -12, right: 0, zIndex: 10, opacity: mainImgMenuOpen === menuKey ? 1 : undefined, pointerEvents: mainImgMenuOpen === menuKey ? 'auto' : undefined }}>
                          <button onClick={() => setMainImgMenuOpen(mainImgMenuOpen === menuKey ? null : menuKey)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}><ImageIcon size={12} /> Alterar Imagem</button>
                          {mainImgMenuOpen === menuKey && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
                              <button onClick={() => handleMainImageAction(q.id, i, 'upload', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#334155', cursor: 'pointer', borderRadius: 4, textAlign: 'left' }}><Upload size={14} /> Fazer Upload</button>
                              <button onClick={() => handleMainImageAction(q.id, i, 'ai', q.enunciado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'transparent', border: 'none', fontSize: 12, color: '#8b5cf6', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontWeight: 600 }}><Sparkles size={14} /> Gerar com IA</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              """

content = content[:part_img_start] + replacement + content[part_img_end:]

with open('components/simulados/PageContent.tsx', 'w') as f:
    f.write(content)
print("done")
