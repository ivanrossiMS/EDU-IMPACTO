const fs = require('fs');
const familiaPath = 'app/agenda-digital/[slug]/momentos/page.tsx';
const collabPath = 'app/agenda-digital/colaborador/momentos/page.tsx';

let code = fs.readFileSync(familiaPath, 'utf8');

// 1. Change component name and remove params
code = code.replace(/export default function ADMomentosPage\([^)]+\) \{/, 'export default function ADMomentosPage() {');
code = code.replace(/const resolvedParams = use\(params[^\n]+/, '');

// 2. Remove student logic
code = code.replace(/const aluno = [^\n]+/, '');
code = code.replace(/const turmaDoAluno = [^\n]+/, '');
code = code.replace(/const turmaObj = [^\n]+/, '');
code = code.replace(/const nomeTurmaDoAluno = [^\n]+/, '');

// 3. Add Turma Selection State
const turmaState = `
  const { chatGroups } = useAgendaDigital()
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('all')

  const turmaOptions = React.useMemo(() => {
    const userGroups = (chatGroups || []).filter(g => g.colaboradoresIds?.includes(currentUser?.id || ''))
    const accessibleTurmas = turmas.filter(t => {
       return userGroups.some(g => String(g.id) === \`sync-\${t.id}\` || g.nome === t.nome)
    })
    if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Direção') {
      return [{ id: 'all', nome: 'Todas as Turmas' }, ...turmas]
    }
    return [{ id: 'all', nome: 'Minhas Turmas' }, ...accessibleTurmas]
  }, [turmas, chatGroups, currentUser])

  const selectedTurmaName = React.useMemo(() => {
    if (selectedTurmaId === 'all') return 'Todas as Turmas'
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? t.nome : 'Turma Selecionada'
  }, [selectedTurmaId, turmas])

  // Get list of active turmas to filter moments
  const activeTurmas = React.useMemo(() => {
    if (selectedTurmaId === 'all') {
      return turmaOptions.filter(t => t.id !== 'all')
    }
    const t = turmas.find(x => String(x.id) === String(selectedTurmaId) || String(x.codigo) === String(selectedTurmaId))
    return t ? [t] : []
  }, [selectedTurmaId, turmaOptions, turmas])
`;
code = code.replace(/const \{ setMomentosFeed \} = useAgendaDigital\(\)/, `const { setMomentosFeed } = useAgendaDigital()\n${turmaState}`);

// 4. Update filtering logic for momentos
const filterLogic = `
  const meusMomentos = momentosFeed.filter(m => {
    if (m.status !== 'approved') return false
    if (!m.targetClasses || m.targetClasses.length === 0) return true
    
    // Check if any of the target classes match our active turmas
    return m.targetClasses.some(tc => {
      const tcl = tc.toLowerCase()
      if (tcl === 'todos' || tcl === 'toda a escola') return true
      return activeTurmas.some(at => 
        tcl.includes(at.nome.toLowerCase()) || 
        at.nome.toLowerCase().includes(tcl)
      )
    })
  }).sort((a, b) => {
    const dateA = new Date((a as any).date || 0).getTime()
    const dateB = new Date((b as any).date || 0).getTime()
    return dateB - dateA
  })
`;
code = code.replace(/const meusMomentos = momentosFeed\.filter[\s\S]*?\}\)/, filterLogic);

// 5. Replace header text and inject dropdown
const dropdownHTML = `
            <h2 className="ad-momentos-title" style={{ 
              fontSize: 'clamp(24px, 4vw, 32px)', 
              fontWeight: 900, 
              fontFamily: 'Outfit, sans-serif', 
              margin: 0, 
              letterSpacing: '-0.03em', 
              background: 'linear-gradient(135deg, #1e293b 0%, #4f46e5 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.04))',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Fotos/Vídeos da Turma
            </h2>
            <div style={{ marginTop: 8, position: 'relative', maxWidth: 300 }}>
                <select 
                  className="form-input"
                  value={selectedTurmaId}
                  onChange={e => setSelectedTurmaId(e.target.value)}
                  style={{ 
                    width: '100%', 
                    appearance: 'none', 
                    padding: '8px 16px', 
                    paddingRight: '40px', 
                    borderRadius: '12px', 
                    border: '1px solid hsl(var(--border-subtle))', 
                    background: 'hsl(var(--bg-main))', 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    color: 'hsl(var(--text-main))', 
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  {turmaOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'hsl(var(--text-muted))' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
            </div>
`;
code = code.replace(/<h2 className="ad-momentos-title"[\s\S]*?Fotos\/Vídeos da Turma\n\s*<\/h2>/, dropdownHTML);
code = code.replace(/<strong style={{ color: '#4f46e5', fontWeight: 800 }}>\{nomeTurmaDoAluno\}<\/strong>/, `<strong style={{ color: '#4f46e5', fontWeight: 800 }}>{selectedTurmaName}</strong>`);

fs.writeFileSync(collabPath, code);
