import os
import re

file_path = "app/(app)/provas/adaptar/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add states
state_insertion = """  const [columns, setColumns] = useState<number>(2) // Layout de colunas
  const [alternativasLayout, setAlternativasLayout] = useState<'vertical' | 'horizontal'>('vertical') // Layout das alternativas"""
content = content.replace("  const [columns, setColumns] = useState<number>(2) // Layout de colunas", state_insertion)

# Add handleEditAlternativaImage
handle_edit = """  const handleEditAlternativaImage = (qId: string, altId: string, url: string) => {
    setQuestoes(prev => prev.map(q => {
      if (q.id === qId) {
        const newAlts = q.provas_alternativas.map((a: any) => a.id === altId ? { ...a, imagem_url: url } : a)
        return {
          ...q,
          provas_alternativas: newAlts,
          simulados_alternativas: newAlts
        }
      }
      return q
    }))
  }

  const handleEditAlternativa ="""
content = content.replace("  const handleEditAlternativa =", handle_edit)

# Add toggle to sidebar
layout_ui = """              </button>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 16 }}>
              <LayoutList size={16} color="#3b82f6" style={{ transform: 'rotate(90deg)' }} /> Layout das Alternativas
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setAlternativasLayout('vertical')}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: alternativasLayout === 'vertical' ? '#3b82f6' : '#f8fafc',
                  color: alternativasLayout === 'vertical' ? 'white' : '#475569',
                  border: `1px solid ${alternativasLayout === 'vertical' ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                Embaixo
              </button>
              <button
                onClick={() => setAlternativasLayout('horizontal')}
                style={{
                  padding: '12px', borderRadius: 12,
                  background: alternativasLayout === 'horizontal' ? '#3b82f6' : '#f8fafc',
                  color: alternativasLayout === 'horizontal' ? 'white' : '#475569',
                  border: `1px solid ${alternativasLayout === 'horizontal' ? '#3b82f6' : '#e2e8f0'}`,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                Lado a Lado
              </button>
            </div>
          </div>"""

# I will find where to inject it by matching the exact end of Layout da Prova
content = re.sub(
    r"(<Columns size=\{16\} /> 2 Colunas\s*</button>\s*</div>\s*</div>)",
    r"\1\n\n" + layout_ui,
    content
)

# Update handleSaveAndPrint to include imagem_url
content = content.replace("eh_correta: a.eh_correta", "eh_correta: a.eh_correta,\n            imagem_url: a.imagem_url")

# Update PaginationEngine props
engine_props = """            <PaginationEngine 
              questoes={selectedList}
              columns={columns}
              alternativasLayout={alternativasLayout}
              fontSize={fontSize}"""
content = content.replace("""            <PaginationEngine 
              questoes={selectedList}
              columns={columns}
              fontSize={fontSize}""", engine_props)

engine_handlers = """              onEditEnunciado={handleEditEnunciado}
              onEditAlternativa={handleEditAlternativa}
              onEditAlternativaImage={handleEditAlternativaImage}
              onRemoveAlternativa={handleRemoveAlternativa}"""
content = content.replace("""              onEditEnunciado={handleEditEnunciado}
              onEditAlternativa={handleEditAlternativa}
              onRemoveAlternativa={handleRemoveAlternativa}""", engine_handlers)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("page.tsx patched successfully!")
