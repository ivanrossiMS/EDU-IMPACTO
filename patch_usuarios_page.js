const fs = require('fs');
const file = 'app/(app)/configuracoes/usuarios/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the states and hook
const statesToReplace = `  const { data: usersData, isLoading: isUsersLoading } = useApiQuery<SysUser[]>('usuarios', '/api/configuracoes/usuarios')
  const users = usersData || []`;

const newStates = `  const [colabPage, setColabPage] = useState(1);
  const [colabLimit, setColabLimit] = useState(20);
  const [colabSearch, setColabSearch] = useState('');
  const [debouncedColabSearch, setDebouncedColabSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedColabSearch(colabSearch), 400);
    return () => clearTimeout(t);
  }, [colabSearch]);

  const { data: colabData, isLoading: isUsersLoading } = useApiQuery<any>(
    ['usuarios', 'colaboradores', colabPage, colabLimit, debouncedColabSearch],
    '/api/configuracoes/usuarios',
    { type: 'colaboradores', page: colabPage, limit: colabLimit, search: debouncedColabSearch }
  )
  const users = colabData?.data || []
  const colabTotal = colabData?.total || 0;`;

// But wait, the original code doesn't exactly match `('usuarios', '/api...`. It was `(['usuarios'], '/api/configuracoes/usuarios')`. Let's use a regex.
content = content.replace(
  /const { data: usersData, isLoading: isUsersLoading } = useApiQuery<SysUser\[\]>\(\['usuarios'\], '\/api\/configuracoes\/usuarios'\)\s*const users = usersData \|\| \[\]/,
  newStates
);

// We need to add the search bar and pagination controls for Colaboradores.
// Currently it renders a table container: `<div className="table-container">`
const tableReplacement = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={colabSearch}
                    onChange={(e) => { setColabSearch(e.target.value); setColabPage(1); }}
                    style={{ padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', fontSize: 13, width: 250 }}
                  />
                </div>
                <select 
                  value={colabLimit} 
                  onChange={(e) => { setColabLimit(Number(e.target.value)); setColabPage(1); }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', fontSize: 13 }}
                >
                  <option value={20}>20 por pág.</option>
                  <option value={50}>50 por pág.</option>
                  <option value={100}>100 por pág.</option>
                </select>
              </div>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                Total: <strong>{colabTotal}</strong>
              </div>
            </div>
            <div className="table-container">`;

content = content.replace(/<div className="table-container">\s*<table>\s*<thead><tr><th>Usuário<\/th>/, tableReplacement + '\n            <table>\n              <thead><tr><th>Usuário</th>');

const paginationFooter = `              </tbody>
            </table>
            
            {colabTotal > colabLimit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                <span style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                  Mostrando {(colabPage - 1) * colabLimit + 1} a {Math.min(colabPage * colabLimit, colabTotal)} de {colabTotal}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => setColabPage(p => Math.max(1, p - 1))}
                    disabled={colabPage === 1}
                  >
                    Anterior
                  </button>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => setColabPage(p => p + 1)}
                    disabled={colabPage * colabLimit >= colabTotal}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>`;

content = content.replace(/<\/tbody>\s*<\/table>\s*<\/div>/, paginationFooter);

// We need to remove the `.filter(u => u.perfil !== 'Família' && u.cargo !== 'Alunos' && u.cargo !== 'Responsáveis')` 
// since the API `type=colaboradores` already only returns system_users (which are not Família by default, but wait, do we still need to filter? Let's just remove it as we are returning mappedSys).
content = content.replace(/users\.filter\(u => u\.perfil !== 'Família'\)\.length === 0/g, 'users.length === 0');
content = content.replace(/users\.filter\(u => u\.perfil !== 'Família'\)\.map\(u => \{/g, 'users.map(u => {');
// For the tabs count:
content = content.replace(/\{users\.filter\(u => u\.perfil !== 'Família' && u\.cargo !== 'Alunos' && u\.cargo !== 'Responsáveis'\)\.length\}/g, '{colabTotal}');
// The other tabs count will just be removed or hardcoded to not break, but since users length is now only for colaboradores, we should remove the count from the other tabs because it's meaningless.
content = content.replace(/\{users\.filter\(u => u\.cargo === 'Alunos'\)\.length\}/g, '');
content = content.replace(/\{users\.filter\(u => u\.cargo === 'Responsáveis'\)\.length\}/g, '');

// Also import Search if not already imported
if (!content.includes('Search,')) {
  content = content.replace(/import \{ Plus,/, 'import { Search, Plus,');
}

fs.writeFileSync(file, content);
