import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/notas/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove selectedTurmaId states and logic
turma_states = """  const turmasIds = useMemo(() => {
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
  }, [responseData, selectedTurmaId])"""

new_states = """  // Extrair anos disponíveis de todos os boletins
  const todosBoletins = useMemo(() => {
    return (responseData?.data || []).map((b: any) => {
      const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : (b.dados || {});
      const ano = dados.ano || new Date(b.created_at).getFullYear().toString();
      
      const turmaRef = b.turma_id || b.turma;
      const tObj = turmas.find((t: any) => String(t.id) === String(turmaRef) || String(t.codigo) === String(turmaRef) || String(t.nome) === String(turmaRef));
      const nomeTurma = tObj?.nome || b.turma || 'Sem Turma';
      
      return { ...b, parsedDados: dados, anoStr: String(ano), nomeTurma };
    });
  }, [responseData, turmas]);

  const anosDisponiveis = useMemo(() => {
    const anos = todosBoletins.map((b: any) => b.anoStr);
    const unicos = Array.from(new Set(anos)).sort((a: any, b: any) => b.localeCompare(a));
    if (unicos.length === 0) {
       unicos.push(new Date().getFullYear().toString());
    }
    return unicos;
  }, [todosBoletins]);

  const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !selectedYear) {
      setSelectedYear(anosDisponiveis[0]);
    }
  }, [anosDisponiveis, selectedYear]);

  // Boletins do ano selecionado
  const boletins = useMemo(() => {
    if (!selectedYear) return [];
    return todosBoletins.filter((b: any) => b.anoStr === selectedYear);
  }, [todosBoletins, selectedYear]);"""

content = content.replace(turma_states, new_states)

# 2. Modify bimestresDisponiveis to use the exact list of boletins of the year, potentially with class name.
old_bimestres = """  // Extract periods (bimestres) available
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length) return []
    
    // Primeiro ordenamos do mais novo para o mais antigo para manter sempre o boletim mais recente em caso de duplicidade
    const sorted = [...boletins].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const unicos = new Map()
    for (const b of sorted) {
      const dados = typeof b.dados === 'string' ? JSON.parse(b.dados) : b.dados
      if (!unicos.has(dados.bimestre)) {
        unicos.set(dados.bimestre, { id: b.id, nome: dados.bimestre, dados })
      }
    }

    return Array.from(unicos.values()).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
  }, [boletins])"""

new_bimestres = """  // Extract periods (bimestres) available
  const bimestresDisponiveis = useMemo(() => {
    if (!boletins.length) return []
    
    // Contar quantas turmas distintas existem no ano
    const turmasNoAno = new Set(boletins.map((b: any) => b.nomeTurma));
    const isMultiClass = turmasNoAno.size > 1;

    const sorted = [...boletins].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    const res = [];
    for (const b of sorted) {
      const label = isMultiClass ? `${b.parsedDados.bimestre} - ${b.nomeTurma}` : b.parsedDados.bimestre;
      res.push({ id: b.id, nome: label, dados: b.parsedDados, originalTitle: b.parsedDados.bimestre, nomeTurma: b.nomeTurma })
    }

    return res.sort((a: any, b: any) => a.originalTitle.localeCompare(b.originalTitle))
  }, [boletins])"""

content = content.replace(old_bimestres, new_bimestres)

# 3. Fix the UI Header: Replace Turma select with Year select.
old_ui_header = """          {/* Turma Selector */}
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
          </div>"""

new_ui_header = """          {/* Ano Letivo Selector */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
            >
              {anosDisponiveis.map((ano: string) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} color="#64748b" /> Ano: {selectedYear}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>"""

content = content.replace(old_ui_header, new_ui_header)

# 4. In "Card Resumo Global", show the Class name too, since it is important if there are multiple.
old_resumo_text = """                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: 500 }}>
                    Referente ao {boletimAtual.nome} {boletimAtual.dados.ano ? `de ${boletimAtual.dados.ano}` : ''}
                  </div>"""

new_resumo_text = """                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8, fontWeight: 500 }}>
                    Referente ao {boletimAtual.originalTitle} {boletimAtual.dados.ano ? `de ${boletimAtual.dados.ano}` : ''} <strong style={{ color: '#0f172a' }}>({boletimAtual.nomeTurma})</strong>
                  </div>"""

content = content.replace(old_resumo_text, new_resumo_text)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Notas patched!")
