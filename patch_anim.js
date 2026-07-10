const fs = require('fs');
let code = fs.readFileSync('app/agenda-digital/colaborador/comunicados/page.tsx', 'utf8');

const hookTarget = `const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])`;

const newHookTarget = `const [isClient, setIsClient] = useState(false)
  const [isSimulatedLoading, setIsSimulatedLoading] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])`;

code = code.replace(hookTarget, newHookTarget);

const btnTarget = `<button 
                className="btn btn-primary" 
                style={{ 
                  borderRadius: 24, 
                  padding: '12px 32px', 
                  fontWeight: 600, 
                  boxShadow: '0 8px 16px -4px rgba(99,102,241,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isFetchingNextPageComunicados ? 0.8 : 1,
                  cursor: isFetchingNextPageComunicados ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s'
                }}
                disabled={isFetchingNextPageComunicados}
                onClick={() => {
                if (limit >= filteredComunicados.length && hasNextPageComunicados && fetchNextPageComunicados) {
                  fetchNextPageComunicados()
                }
                setLimit(l => l + 6)
              }}>
                {isFetchingNextPageComunicados ? (
                  <>
                    <svg className="animate-spin" style={{ width: 20, height: 20, color: 'white' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando...
                  </>
                ) : 'Carregar mais'}
              </button>`;

const newBtn = `<button 
                className="btn btn-primary" 
                style={{ 
                  borderRadius: 24, 
                  padding: '12px 32px', 
                  fontWeight: 600, 
                  boxShadow: '0 8px 16px -4px rgba(99,102,241,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isFetchingNextPageComunicados || isSimulatedLoading) ? 0.8 : 1,
                  cursor: (isFetchingNextPageComunicados || isSimulatedLoading) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s'
                }}
                disabled={isFetchingNextPageComunicados || isSimulatedLoading}
                onClick={() => {
                setIsSimulatedLoading(true);
                if (limit >= filteredComunicados.length && hasNextPageComunicados && fetchNextPageComunicados) {
                  fetchNextPageComunicados()
                }
                setTimeout(() => {
                  setLimit(l => l + 6)
                  setIsSimulatedLoading(false);
                }, 800)
              }}>
                {(isFetchingNextPageComunicados || isSimulatedLoading) ? (
                  <>
                    <svg className="animate-spin" style={{ width: 20, height: 20, color: 'white' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Carregando...
                  </>
                ) : 'Carregar mais'}
              </button>`;

code = code.replace(btnTarget, newBtn);
fs.writeFileSync('app/agenda-digital/colaborador/comunicados/page.tsx', code);
console.log('Patched button logic');
