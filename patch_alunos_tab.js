const fs = require('fs');
const file = 'components/usuarios/AuthAlunosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// The original states and useApiQuery block:
/*
  const { data: apiData, isLoading } = useApiQuery<any>(
    ['alunos_auth_tab'],
    '/api/alunos',
    { lightweight: true, all: true, limit: 10000 }
  )
  const queryClient = useQueryClient()

  // Sincronização e fallback local seguro para edições imediatas na UI
  const [localAlunos, setLocalAlunos] = useState<any[]>([])

  useEffect(() => {
    if (apiData && Array.isArray(apiData.data)) {
      setLocalAlunos(apiData.data)
    }
  }, [apiData])

  const alunos = localAlunos
  const setAlunos = setLocalAlunos

  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const [authUsers, setAuthUsers] = useLocalStorage<any[]>('edu-auth-users', [])
  const [search, setSearch] = useState('')
*/

const statesRegex = /const \{ data: apiData[\s\S]*?const \[search, setSearch\] = useState\(''\)/;

const newStates = `
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: apiData, isLoading } = useApiQuery<any>(
    ['alunos_auth_tab', page, limit, debouncedSearch],
    '/api/alunos',
    { lightweight: true, page, limit, search: debouncedSearch }
  )
  const queryClient = useQueryClient()

  const [localAlunos, setLocalAlunos] = useState<any[]>([])

  useEffect(() => {
    if (apiData && Array.isArray(apiData.data)) {
      setLocalAlunos(apiData.data)
    }
  }, [apiData])

  const alunos = localAlunos
  const setAlunos = setLocalAlunos
  const totalItems = apiData?.total || 0;

  const [todasTurmas] = useSupabaseArray<any>('turmas');
  const [authUsers, setAuthUsers] = useLocalStorage<any[]>('edu-auth-users', [])`;

content = content.replace(statesRegex, newStates);

// We need to remove frontend search filtering.
// Previously it did: 
// const filtered = useMemo(() => { ... filter search ... }, [alunos, search])
// Let's replace the `filtered` definition to just return `alunos` since the backend handles search and pagination.
const filteredRegex = /const filtered = useMemo\(\(\) => \{[\s\S]*?return filtered\s*\}, \[alunos, search\]\)/;
const newFiltered = `const filtered = alunos;`;

content = content.replace(filteredRegex, newFiltered);

// Add the pagination UI controls inside `<div className="table-container">`
// Let's replace `<div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>` 
// which is the search bar container.

const searchContainerRegex = /<div style=\{\{ display: 'flex', gap: 12, marginBottom: 16 \}\}>\s*<div style=\{\{ position: 'relative', flex: 1, maxWidth: 300 \}\}>\s*<Search[\s\S]*?<\/div>\s*<\/div>/;

const newSearchContainer = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input
              type="text"
              placeholder="Buscar aluno por nome, matrícula ou e-mail..."
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

// Add pagination footer at the end of the table
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
