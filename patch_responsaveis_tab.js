const fs = require('fs');
const file = 'components/usuarios/AuthResponsaveisTab.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexAPIAndStates = /const \{ data: apiData[\s\S]*?const guardians = useMemo\(\(\) => \{[\s\S]*?return allGuardians\.filter\(\(g: any\) => \{[\s\S]*?\}\)[\s\S]*?\}, \[alunos\]\)/;

const newAPIAndStates = `
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: apiData, isLoading } = useApiQuery<any>(
    ['responsaveis_auth_tab', page, limit, debouncedSearch],
    '/api/responsaveis',
    { page, limit, search: debouncedSearch }
  )
  const queryClient = useQueryClient()

  const [localResps, setLocalResps] = useState<any[]>([])

  useEffect(() => {
    if (apiData && Array.isArray(apiData.data)) {
      setLocalResps(apiData.data)
    }
  }, [apiData])

  const guardians = localResps
  const totalItems = apiData?.total || 0;

  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const [authUsers, setAuthUsers] = useLocalStorage<any[]>('edu-auth-users', [])
  const [editModal, setEditModal] = useState<any | null>(null)
  const [resetModal, setResetModal] = useState<any | null>(null)
  const [linksModal, setLinksModal] = useState<any | null>(null)
  
  // States for resetting password
  const [resetParams, setResetParams] = useState({ mode: 'auto', password: '', confirm: '', sendSms: false, sendEmail: false, requireChange: true })
  const [copied, setCopied] = useState(false)

  const getTurmaNome = (id: string) => {
    return (todasTurmas || []).find((t: any) => String(t.id) === String(id))?.nome || id
  }
`;

content = content.replace(regexAPIAndStates, newAPIAndStates);

const displayedRegex = /const displayed = guardians\.map\(g => \{[\s\S]*?return item\.nome\.toLowerCase\(\)\.includes\(q\) \|\| \(item\.cpf && item\.cpf\.includes\(q\)\) \|\| \(item\.auth\?\.login\?\.toLowerCase\(\)\.includes\(q\)\)\s*\}\)/;

const newDisplayed = `const displayed = guardians.map(g => {
    const refKey = g.email || g.cpf || g.nome
    const authRecord = authUsers.find(u => u.user_type === 'guardian' && (u.reference_key === refKey || (g.cpf && u.reference_key === g.cpf) || (g.email && u.reference_key === g.email)))
    
    const searchEmail = (g.email || (authRecord?.email) || '').trim().toLowerCase()
    const realUser = usersData?.find(u => u.email?.toLowerCase() === searchEmail && u.perfil === 'Família')

    const defaultAuth = {
      id: \`virtual-\${refKey}\`,
      user_type: 'guardian',
      reference_key: refKey,
      login: g.email || g.celular || g.telefone || '',
      email: g.email || '',
      celular: g.celular || g.telefone || '',
      status: 'ATIVO',
      profile_code: 'FAMILIA',
      last_login: realUser ? realUser.ultimoAcesso : null
    }

    const auth = authRecord || defaultAuth
    if (realUser && realUser.ultimoAcesso) {
      auth.last_login = realUser.ultimoAcesso === 'Nunca acessou' ? null : realUser.ultimoAcesso
    }

    // Map backward compatibility for UI
    g.key = refKey
    if(g.alunosVinculados) {
      g.alunos = g.alunosVinculados
      g.tipos = new Set()
      g.alunosVinculados.forEach((l: any) => {
        if(l.isFinanceiro) g.tipos.add('Financeiro')
        if(l.isPedagogico) g.tipos.add('Pedagógico')
      })
      if(g.tipos.size === 0) g.tipos.add('Outro')
    }

    return { ...g, auth }
  })`;

content = content.replace(displayedRegex, newDisplayed);

// Fix search bar and add pagination controls
const searchContainerRegex = /<div style=\{\{ display: 'flex', gap: 12, marginBottom: 16 \}\}>\s*<div style=\{\{ position: 'relative', flex: 1, maxWidth: 300 \}\}>\s*<Search[\s\S]*?<\/div>\s*<\/div>/;

const newSearchContainer = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input
              type="text"
              placeholder="Buscar responsável por nome ou e-mail..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', fontSize: 13, width: 300 }}
            />
          </div>
          <select 
            value={limit} 
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', fontSize: 13 }}
          >
            <option value={20}>20 por pág.</option>
            <option value={50}>50 por pág.</option>
            <option value={100}>100 por pág.</option>
          </select>
        </div>
        <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
          Total: <strong>{totalItems}</strong>
        </div>
      </div>`;

content = content.replace(searchContainerRegex, newSearchContainer);

// Pagination footer
const endTableRegex = /<\/tbody>\s*<\/table>\s*<\/div>\s*<AnimatePresence>/;
const newEndTable = `</tbody>
        </table>

        {totalItems > limit && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid hsl(var(--border-subtle))' }}>
            <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
              Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, totalItems)} de {totalItems}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= totalItems}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>`;

content = content.replace(endTableRegex, newEndTable);

fs.writeFileSync(file, content);
