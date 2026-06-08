import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/notas/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add useData import if not there
if "import { useData }" not in content:
    content = content.replace(
        "import { useSelectedStudent } from '@/lib/selectedStudentContext'",
        "import { useSelectedStudent } from '@/lib/selectedStudentContext'\nimport { useData } from '@/lib/dataContext'"
    )

# Add turmas context
content = content.replace(
    "const { aluno } = useSelectedStudent()",
    "const { aluno } = useSelectedStudent()\n  const { turmas = [] } = useData()"
)

# Replace const boletins = ... with filtered boletins based on selectedTurma
turma_logic = """
  const turmasIds = useMemo(() => {
    const ids = [aluno?.turma];
    if (aluno?.dados?.historicoTurmas) {
      aluno.dados.historicoTurmas.forEach((ht: any) => {
        if (ht.serieTurma) ids.push(ht.serieTurma);
      });
    }
    return ids.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  }, [aluno]);

  const turmasDisponiveis = useMemo(() => {
    return turmasIds.map(id => {
      const t = turmas.find(t => String(t.id) === String(id) || String(t.codigo) === String(id) || String(t.nome) === String(id));
      return { id, nome: t?.nome || id };
    });
  }, [turmasIds, turmas]);

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');

  useEffect(() => {
    if (turmasDisponiveis.length > 0 && !selectedTurmaId) {
      const current = turmasDisponiveis.find(t => String(t.id) === String(aluno?.turma)) || turmasDisponiveis[0];
      setSelectedTurmaId(current.id);
    }
  }, [turmasDisponiveis, selectedTurmaId, aluno?.turma]);

  // Filter boletins per selected turma
  const boletins = useMemo(() => {
    const raw = responseData?.data || []
    if (!selectedTurmaId) return raw
    return raw.filter((b: any) => String(b.turma_id) === String(selectedTurmaId) || String(b.turma) === String(selectedTurmaId) || !b.turma_id) // loose match
  }, [responseData, selectedTurmaId])
"""

content = content.replace("const boletins = responseData?.data || []", turma_logic)

# Replace Top Header with Dropdown
header_replacement = """      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, color: '#0f172a' }}>Boletim e Notas</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Turma Selector */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select 
              value={selectedTurmaId} 
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
            >
              {turmasDisponiveis.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              <span>{turmasDisponiveis.find(t => t.id === selectedTurmaId)?.nome || 'Sem Turma'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 600, padding: '8px 16px', borderRadius: 12 }}>
            <Download size={16} /> <span className="hide-on-mobile">Baixar PDF</span>
          </button>
        </div>
      </div>"""

content = re.sub(
    r"<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>.*?</div>",
    header_replacement,
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Notas page patched!")
