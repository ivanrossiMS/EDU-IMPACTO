const fs = require('fs');

const familyCode = fs.readFileSync('app/agenda-digital/[slug]/comunicados/page.tsx', 'utf8');

// Replace imports
let colabCode = familyCode.replace(
  "import { useSelectedStudent } from '@/lib/selectedStudentContext'",
  "import { useApp } from '@/lib/context'\nimport { Plus } from 'lucide-react'"
);
colabCode = colabCode.replace(
  "import { useData } from '@/lib/dataContext'\nimport { supabase } from '@/lib/supabase'\n",
  ""
);

// Replace component signature
colabCode = colabCode.replace(
  "export default function ADComunicadosPage({ params }: { params: Promise<{ slug: string }>}) {",
  "export default function ColaboradorComunicadosPage() {\n  const { currentUser } = useApp()\n  const [showComposer, setShowComposer] = useState(false)\n  const [newTitulo, setNewTitulo] = useState('')\n  const [newConteudo, setNewConteudo] = useState('')\n  const [destinatario, setDestinatario] = useState('Turma Inteira')\n  const userSlug = currentUser?.id || 'colaborador';"
);

// Remove params resolution
colabCode = colabCode.replace(
  "const resolvedParams = use(params as Promise<{ slug: string }>)",
  ""
);

// Replace state variables
colabCode = colabCode.replace(
  "const { aluno } = useSelectedStudent()",
  "const { comunicados, setComunicados } = useAgendaDigital()"
);

// Remove data, turmas, Supabase
colabCode = colabCode.replace(
  /const { turmas = \[\] } = useData\(\)[\s\S]*?const \[comunicados, setComunicados, \{ loading \}\] = useSupabaseArray<any>\(endpoint\)/,
  "const loading = false;"
);

// Remove realtime and polling
colabCode = colabCode.replace(
  /\/\/ --- REALTIME SUBSCRIPTION ---[\s\S]*?\/\/ --- POLLING FALLBACK ---[\s\S]*?return \(\) => clearInterval\(interval\);\n  \}, \[aluno\?\.id, turmaNome\]\)/,
  ""
);

// Replace resolvedParams.slug with userSlug
colabCode = colabCode.replace(/resolvedParams\.slug/g, "userSlug");

// Replace aluno?.id with currentUser?.id
colabCode = colabCode.replace(/aluno\?\.id/g, "currentUser?.id");
colabCode = colabCode.replace(/aluno\?\.nome/g, "currentUser?.nome");

// Add button
colabCode = colabCode.replace(
  /<button className="btn btn-secondary ad-com-filter-btn"[\s\S]*?<Filter size=\{16\} \/> Filtros\n            <\/button>/,
  `$&
            <button className="btn btn-primary" onClick={() => setShowComposer(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44, borderRadius: 14, padding: '0 18px', fontSize: 14, fontWeight: 600 }}>
              <Plus size={16} /> Novo
            </button>`
);

// Add composer modal
const composerModal = `
      <AnimatePresence>
      {showComposer && (
        <Portal>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 24, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Novo Comunicado</h3>
              <button className="btn btn-ghost btn-sm" style={{ padding: 6, borderRadius: '50%' }} onClick={() => setShowComposer(false)}><X size={20} /></button>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>Destinatário</label>
                <select className="form-input" value={destinatario} onChange={e => setDestinatario(e.target.value)} style={{ padding: '10px 14px', fontSize: 14, borderRadius: 12, border: '1px solid #cbd5e1', width: '100%' }}>
                  <option value="Turma Inteira">Toda a Turma</option>
                  <option value="Alunos Específicos">Somente Responsáveis</option>
                  <option value="Coordenação">Coordenação Pedagógica</option>
                </select>
              </div>

              <div>
                 <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>Título do Comunicado</label>
                 <input className="form-input" placeholder="Ex: Aviso de Feriado" style={{ fontSize: 15, fontWeight: 600, padding: '10px 14px', borderRadius: 12, border: '1px solid #cbd5e1', width: '100%' }} value={newTitulo} onChange={e => setNewTitulo(e.target.value)} />
              </div>

              <div>
                 <label style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>Mensagem Principal</label>
                 <div style={{ border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden' }}>
                    <textarea 
                      className="form-input" 
                      placeholder="Escreva sua mensagem aqui..." 
                      style={{ height: 180, resize: 'none', border: 'none', borderRadius: 0, boxShadow: 'none', width: '100%', padding: '14px', fontSize: 15 }}
                      value={newConteudo}
                      onChange={e => setNewConteudo(e.target.value)}
                    />
                 </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-secondary" style={{ borderRadius: 12, fontWeight: 600 }} onClick={() => setShowComposer(false)}>Cancelar</button>
               <button className="btn btn-primary" style={{ borderRadius: 12, fontWeight: 600, background: '#4f46e5' }} onClick={() => {
                 if (!newTitulo.trim() || !newConteudo.trim()) return;
                 const newCom = {
                   id: \`AD-COM-COLAB-\${Date.now()}\`,
                   titulo: newTitulo,
                   conteudo: newConteudo,
                   tipo: 'texto',
                   autor: currentUser?.nome || 'Colaborador',
                   autorCargo: currentUser?.cargo || currentUser?.perfil || 'Colaborador',
                   autorId: currentUser?.id || '',
                   autorFoto: currentUser?.foto || null,
                   prioridade: 'normal',
                   fixado: false,
                   exigeCiencia: false,
                   dataEnvio: new Date().toISOString(),
                   anexos: [],
                   leituras: {},
                   ciencias: {},
                   status: 'enviado'
                 }
                 setComunicados(prev => [newCom, ...(prev || [])])
                 setShowComposer(false)
                 setNewTitulo('')
                 setNewConteudo('')
               }}>Enviar Comunicado</button>
            </div>
          </motion.div>
        </motion.div>
        </Portal>
      )}
      </AnimatePresence>
`;

colabCode = colabCode.replace(
  /<\/div>\n    <\/div>\n  \)\n\}\n$/,
  composerModal + "\n      </div>\n    </div>\n  )\n}\n"
);

// If !currentUser, return early
colabCode = colabCode.replace(
  "const [searchTerm, setSearchTerm] = useState('')",
  "const [searchTerm, setSearchTerm] = useState('')\n\n  if (!currentUser) return null;\n"
);

fs.writeFileSync('app/agenda-digital/colaborador/comunicados/page.tsx', colabCode);
