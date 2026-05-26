const fs = require('fs');
const familiaPath = 'app/agenda-digital/[slug]/conversas/page.tsx';
const collabPath = 'app/agenda-digital/colaborador/conversas/page.tsx';

let code = fs.readFileSync(familiaPath, 'utf8');

// 1. Change component name and params
code = code.replace(
  /export default function ADConversasPage\([^)]+\) \{/,
  'export default function ADConversasPage() {'
);

// Remove use(params)
code = code.replace(/const resolvedParams = use\(params[^\n]+/, '');
code = code.replace(/const studentId = resolvedParams\.slug/, '');
code = code.replace(/const aluno = [^\n]+/, '');

// 2. Add turma selection logic
const turmaState = `
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

  const alunosDaTurma = React.useMemo(() => {
    if (selectedTurmaId === 'all') {
      const accessibleTurmaIds = turmaOptions.filter(t => t.id !== 'all').map(t => String(t.id))
      return alunos.filter(a => accessibleTurmaIds.includes(String(a.turma)) || accessibleTurmaIds.includes(String(a.turmaId)))
    }
    return alunos.filter(a => String(a.turma) === String(selectedTurmaId) || String(a.turmaId) === String(selectedTurmaId))
  }, [alunos, selectedTurmaId, turmaOptions])
`;

code = code.replace(/const \[chats, setChats\] = useState<any\[\]>\(\[\]\)/, turmaState + '\n  const [chats, setChats] = useState<any[]>([])');

// 3. Update useEffect for filtering chats
const newUseEffect = `
  useEffect(() => {
    // Para o Colaborador, queremos ver todas as conversas relacionadas aos alunos das turmas que ele tem acesso.
    // O ID do chat segue o formato: \`\${studentId}-\${grupoId}-\${colaboradorId}-\${timestamp}\`
    const allowedStudentIds = new Set(alunosDaTurma.map(a => String(a.id)))
    const myGroupIds = new Set((chatGroups || []).filter(g => g.colaboradoresIds?.includes(currentUser?.id || '')).map(g => String(g.id)))

    const filteredChats = chatsList.filter(c => {
      const parts = String(c.id).split('-')
      const chatStudentId = parts[0]
      const chatGroupId = parts[1]
      const chatColabId = parts[2]
      
      // Admins see all. Collaborators see if they are the direct colab, or if the chat belongs to their group and allowed student
      if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Direção') {
         return allowedStudentIds.has(chatStudentId)
      }
      
      const isMyChat = String(chatColabId) === String(currentUser?.id) || myGroupIds.has(String(chatGroupId))
      return isMyChat && allowedStudentIds.has(chatStudentId)
    })
    
    const uniqueChats = []
    const seenIds = new Set()
    for (const chat of filteredChats) {
      if (!seenIds.has(chat.id)) {
        seenIds.add(chat.id)
        uniqueChats.push(chat)
      }
    }
    
    uniqueChats.sort((a, b) => {
      const parseDate = (d, t) => {
        if (!d || !t) return 0;
        const parts = d.split('/');
        if (parts.length !== 3) return 0;
        const [day, month, year] = parts;
        const [hour, min] = t.split(':');
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min)).getTime();
      }
      return parseDate(b.date, b.time) - parseDate(a.date, a.time);
    })
    
    setChats(uniqueChats)
    if (activeChat && !filteredChats.some(c => c.id === activeChat.id)) {
      setActiveChat(null)
    }
  }, [chatsList, alunosDaTurma, currentUser])
`;

code = code.replace(/useEffect\(\(\) => \{\n\s*const studentChats[\s\S]*?\}, \[chatsList, studentId\]\)/, newUseEffect);

// 4. Update the handleSend logic to swap 'them' and 'us'
// Family sends as 'them', school sends as 'us'
code = code.replace(/sender: 'them'/g, "sender: 'us'");

// Also change auto-reply since the school shouldn't auto-reply to itself
// Remove the auto-reply logic from handleSend completely for Colaboradores
code = code.replace(/\/\/ Auto-reply logic for after-hours[\s\S]*?\} catch\(err\) \{\n\s*console\.error\('Error sending auto-reply:', err\)\n\s*\}/, '');

// 5. Inject the Dropdown in the Header
const dropdownHTML = `
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))', letterSpacing: '-0.02em', margin: 0 }}>Mensagens</h2>
              
              <div style={{ position: 'relative' }}>
                <select 
                  className="form-input"
                  value={selectedTurmaId}
                  onChange={e => { setSelectedTurmaId(e.target.value); setActiveChat(null); setShowNovaConversa(false); }}
                  style={{ 
                    width: '100%', 
                    appearance: 'none', 
                    padding: '10px 16px', 
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
            </div>
`;
code = code.replace(/<h2 style={{ fontSize: 24[^>]+>Mensagens<\/h2>/, dropdownHTML);

// 6. Disable "Nova" button for Colaboradores in this simple iteration, as they usually reply. 
// If they want to send a new message, they pick a student, not a group. But let's leave it hidden.
code = code.replace(/\{adConfig\?\.permissoes\?\.chat !== false && \([\s\S]*?Nova\n\s*<\/button>\n\s*\)\}/, '');

// Write file
fs.writeFileSync(collabPath, code);
