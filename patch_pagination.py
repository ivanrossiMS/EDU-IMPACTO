import os

file_path = "components/simulados/PaginationEngine.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add to Props Interface
props_old = """  onEditAlternativa?: (qId: string, altId: string, newHtml: string) => void;
  onRemoveAlternativa?: (qId: string, altId: string) => void;
  onToggleQuestion?: (qId: string) => void;
  isEditHeaderMode?: boolean;
  headerLayout?: string;
  onUpdateHeaderField?: (key: string, newField: any) => void;
  pageA4Ref?: React.RefObject<HTMLDivElement>;
}"""
props_new = """  onEditAlternativa?: (qId: string, altId: string, newHtml: string) => void;
  onEditAlternativaImage?: (qId: string, altId: string, url: string) => void;
  onRemoveAlternativa?: (qId: string, altId: string) => void;
  onToggleQuestion?: (qId: string) => void;
  isEditHeaderMode?: boolean;
  headerLayout?: string;
  alternativasLayout?: 'vertical' | 'horizontal';
  onUpdateHeaderField?: (key: string, newField: any) => void;
  pageA4Ref?: React.RefObject<HTMLDivElement>;
}"""
content = content.replace(props_old, props_new)

# Add to destructuring
destruct_old = """  onEditEnunciado, onEditAlternativa, onRemoveAlternativa, onToggleQuestion,
  isEditHeaderMode, headerLayout, onUpdateHeaderField, pageA4Ref
}: PaginationEngineProps) {"""
destruct_new = """  onEditEnunciado, onEditAlternativa, onEditAlternativaImage, onRemoveAlternativa, onToggleQuestion,
  isEditHeaderMode, headerLayout, alternativasLayout, onUpdateHeaderField, pageA4Ref
}: PaginationEngineProps) {"""
content = content.replace(destruct_old, destruct_new)

# Measurement logic
measure_old = """        const altsH = (q.simulados_alternativas || []).map((a: any) => {
          const h = heights[`${q.id}-alt-${a.id}`] || 0;
          totalH += h + ALT_SPACING;
          return h;
        });"""
measure_new = """        let altsH: number[] = [];
        if (alternativasLayout === 'horizontal') {
          const h = heights[`${q.id}-alts-container`] || 0;
          totalH += h + ALT_SPACING;
          altsH = [h];
        } else {
          altsH = (q.simulados_alternativas || []).map((a: any) => {
            const h = heights[`${q.id}-alt-${a.id}`] || 0;
            totalH += h + ALT_SPACING;
            return h;
          });
        }"""
content = content.replace(measure_old, measure_new)

# Push block logic
push_old = """          } else {
            (q.simulados_alternativas || []).forEach((a: any, i: number) => {
               pushBlock({ type: 'part_alt', q, alt: a }, altsH[i], ALT_SPACING);
            });
          }"""
push_new = """          } else {
            if (alternativasLayout === 'horizontal') {
              pushBlock({ type: 'part_alts_container', q }, altsH[0], ALT_SPACING);
            } else {
              (q.simulados_alternativas || []).forEach((a: any, i: number) => {
                 pushBlock({ type: 'part_alt', q, alt: a }, altsH[i], ALT_SPACING);
              });
            }
          }"""
content = content.replace(push_old, push_new)

# Shadow DOM render logic
shadow_render_old = """            {q.simulados_alternativas?.map((a: any) => (
              <div key={`shadow-alt-${a.id}`} data-measure data-id={`${q.id}-alt-${a.id}`} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '24px', height: '24px', minWidth: '24px', borderRadius: '24px',
                  border: '2px solid #cbd5e1', color: '#475569', fontWeight: 800, fontSize: '10pt', marginTop: '2px'
                }}>
                  {a.letra}
                </div>
                <div style={{ flex: 1 }}>
                  <HtmlContent html={a.texto} style={{ wordBreak: 'break-word' }} />
                </div>
              </div>
            ))}"""
shadow_render_new = """            {alternativasLayout === 'horizontal' ? (
              <div data-measure data-id={`${q.id}-alts-container`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                {q.simulados_alternativas?.map((a: any) => (
                  <div key={`shadow-alt-${a.id}`} style={{ display: 'flex', gap: 12 }}>
                    <div style={{
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
            ) : (
              q.simulados_alternativas?.map((a: any) => (
                <div key={`shadow-alt-${a.id}`} data-measure data-id={`${q.id}-alt-${a.id}`} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <div style={{
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
              ))
            )}"""
content = content.replace(shadow_render_old, shadow_render_new)

# Passing to PageContent
pagecontent_old = """              onRemoveAlternativa={onRemoveAlternativa} onToggleQuestion={onToggleQuestion} forceRepaginate={forceRepaginate} 
              isEditHeaderMode={isEditHeaderMode} headerLayout={headerLayout} onUpdateHeaderField={onUpdateHeaderField} pageA4Ref={pageA4Ref}"""
pagecontent_new = """              onRemoveAlternativa={onRemoveAlternativa} onToggleQuestion={onToggleQuestion} forceRepaginate={forceRepaginate} 
              isEditHeaderMode={isEditHeaderMode} headerLayout={headerLayout} onUpdateHeaderField={onUpdateHeaderField} pageA4Ref={pageA4Ref}
              alternativasLayout={alternativasLayout} onEditAlternativaImage={onEditAlternativaImage}"""
content = content.replace(pagecontent_old, pagecontent_new)

# Same for second PageContent
pagecontent2_old = """                onRemoveAlternativa={onRemoveAlternativa} onToggleQuestion={onToggleQuestion} forceRepaginate={forceRepaginate} 
                isEditHeaderMode={isEditHeaderMode} headerLayout={headerLayout} onUpdateHeaderField={onUpdateHeaderField}"""
pagecontent2_new = """                onRemoveAlternativa={onRemoveAlternativa} onToggleQuestion={onToggleQuestion} forceRepaginate={forceRepaginate} 
                isEditHeaderMode={isEditHeaderMode} headerLayout={headerLayout} onUpdateHeaderField={onUpdateHeaderField}
                alternativasLayout={alternativasLayout} onEditAlternativaImage={onEditAlternativaImage}"""
content = content.replace(pagecontent2_old, pagecontent2_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("PaginationEngine patched!")
