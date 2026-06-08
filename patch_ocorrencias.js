const fs = require('fs');
const file = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/ocorrencias/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const tDisponiveisStr = `
  // Extrair turmas disponíveis dinamicamente
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
`;

content = content.replace(
  'const anosDisponiveis = useMemo(() => {',
  tDisponiveisStr + '\n  const anosDisponiveis = useMemo(() => {'
);

content = content.replace(
  'const ocorrenciasFiltradas = useMemo(() => {',
  `const ocorrenciasFiltradas = useMemo(() => {
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
  }, [ocorrenciasDoAluno, selectedYear, selectedTurmaId, turmasDisponiveis])

  // Lógica anterior ignorada:`
);

content = content.replace(
  `// Resolve a turma do aluno com nome e turno correspondente
  const turmaDoAluno = useMemo(() => {
    if (!aluno) return 'SEM TURMA'
    const rawTurma = aluno.turma
    const turmaObj = turmas.find(t => String(t.id) === String(rawTurma) || String(t.codigo) === String(rawTurma) || String(t.nome) === String(rawTurma))
    
    const nome = turmaObj?.nome || aluno.turma_nome || rawTurma || 'Sem Turma'
    const turno = turmaObj?.turno || aluno.turno || 'Vespertino'
    
    return \`\${nome} - \${turno}\`.toUpperCase()
  }, [aluno, turmas])`,
  `// Resolve a turma selecionada com nome e turno correspondente
  const turmaDoAluno = useMemo(() => {
    if (!aluno || !selectedTurmaId) return 'SEM TURMA'
    const turmaObj = turmas.find(t => String(t.id) === String(selectedTurmaId) || String(t.codigo) === String(selectedTurmaId) || String(t.nome) === String(selectedTurmaId))
    
    const nome = turmaObj?.nome || selectedTurmaId || 'Sem Turma'
    const turno = turmaObj?.turno || aluno.turno || 'Vespertino'
    
    return \`\${nome} - \${turno}\`.toUpperCase()
  }, [aluno, turmas, selectedTurmaId])`
);

const selectTurmaJSX = `
          {/* Class Pill Dropdown (Turma) */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select 
              value={selectedTurmaId} 
              onChange={(e) => setSelectedTurmaId(e.target.value)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 2
              }}
            >
              {turmasDisponiveis.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: '#1e293b',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}>
              <School size={15} style={{ color: '#64748b' }} />
              <span>{turmasDisponiveis.find(t => t.id === selectedTurmaId)?.nome || turmaDoAluno}</span>
              <ChevronDown size={14} style={{ color: '#64748b' }} />
            </div>
          </div>
`;

content = content.replace(
  `          {/* Class Pill (Turma) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            color: '#1e293b',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{turmaDoAluno}</span>
          </div>`,
  selectTurmaJSX
);

fs.writeFileSync(file, content);
console.log('ocorrencias page patched');
