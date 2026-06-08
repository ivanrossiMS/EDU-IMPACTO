import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/ocorrencias/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Simplify ocorrenciasFiltradas logic (Remove selectedTurmaId filter)
old_filtradas = """  // Filtra as ocorrências pelo ano selecionado
  const ocorrenciasFiltradas = useMemo(() => {
    if (!selectedYear || !selectedTurmaId) return []
    return ocorrenciasDoAluno.filter(o => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString())
      // Check if this occurrence belongs to the selected turma.
      // Usually o.turma or o.turma_id could match selectedTurmaId or the name of the selected turma
      const selectedT = turmasDisponiveis.find(t => t.id === selectedTurmaId);
      const isTurmaMatch = String(o.turma) === String(selectedTurmaId) || 
                           String(o.turma) === String(selectedT?.nome) ||
                           String(o.turma_id) === String(selectedTurmaId) || 
                           (!o.turma && !o.turma_id); // If no turma recorded, show it anyway? Actually we should match. Let's just do a loose match or show if no class specified.
      
      const actuallyMatches = o.turma ? isTurmaMatch : true; // fallback if older occurrences don't have turma
      
      return ano === selectedYear && actuallyMatches;
    })
  }, [ocorrenciasDoAluno, selectedYear, selectedTurmaId, turmasDisponiveis])"""

new_filtradas = """  // Filtra as ocorrências pelo ano selecionado (independente da turma)
  const ocorrenciasFiltradas = useMemo(() => {
    if (!selectedYear) return []
    return ocorrenciasDoAluno.filter(o => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : new Date().getFullYear().toString())
      return ano === selectedYear;
    })
  }, [ocorrenciasDoAluno, selectedYear])"""

content = content.replace(old_filtradas, new_filtradas)

# 2. Remove selectedTurmaId UI Dropdown
old_ui_header = """          {/* Ano Letivo Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
              >
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                <Calendar size={14} color="#64748b" />
                <span>{selectedYear}</span>
                <ChevronDown size={14} color="#64748b" />
              </div>
            </div>
            
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
                <School size={14} color="#64748b" />
                <span>{turmasDisponiveis.find(t => t.id === selectedTurmaId)?.nome || 'Sem Turma'}</span>
                <ChevronDown size={14} color="#64748b" />
              </div>
            </div>
            
            {/* View Mode */}"""

new_ui_header = """          {/* Ano Letivo Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
              >
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                <Calendar size={14} color="#64748b" />
                <span>{selectedYear}</span>
                <ChevronDown size={14} color="#64748b" />
              </div>
            </div>
            
            {/* View Mode */}"""

content = content.replace(old_ui_header, new_ui_header)

# 3. Render Turma name inside the occurrence card
# First, add a helper to map turma_id/turma to name
helper = """  const getNomeTurmaOcorrencia = (o: any) => {
    if (!o.turma && !o.turma_id) return 'Sem turma vinculada';
    const idOrName = o.turma_id || o.turma;
    const tObj = turmas.find(t => String(t.id) === String(idOrName) || String(t.codigo) === String(idOrName) || String(t.nome) === String(idOrName));
    return tObj?.nome || o.turma || 'Turma desconhecida';
  };
"""

content = content.replace("  // Formatador de data e hora para exibição completa", helper + "\n  // Formatador de data e hora para exibição completa")

# 4. Inject Turma label into Timeline view
timeline_inject = """                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      <Calendar size={14} color="#475569" />
                      <span>{displayTime}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                      <User size={14} color="#475569" />
                      <span>{o.registrado_por || 'Sistema'}</span>
                    </div>"""

timeline_new = """                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      <Calendar size={14} color="#475569" />
                      <span>{displayTime}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                      <User size={14} color="#475569" />
                      <span>{o.registrado_por || 'Sistema'}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                      <School size={14} color="#475569" />
                      <span style={{ color: '#4f46e5' }}>{getNomeTurmaOcorrencia(o)}</span>
                    </div>"""
content = content.replace(timeline_inject, timeline_new)

# 5. Inject Turma label into List view
list_inject = """                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Calendar size={14} color="#475569" />
                      <span>{displayTime}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                      <User size={14} color="#475569" />
                      <span>{o.registrado_por || 'Sistema'}</span>
                    </div>"""
list_new = """                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Calendar size={14} color="#475569" />
                      <span>{displayTime}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                      <User size={14} color="#475569" />
                      <span>{o.registrado_por || 'Sistema'}</span>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1' }} />
                      <School size={14} color="#475569" />
                      <span style={{ color: '#4f46e5' }}>{getNomeTurmaOcorrencia(o)}</span>
                    </div>"""
content = content.replace(list_inject, list_new)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("ocorrencias patched!")
