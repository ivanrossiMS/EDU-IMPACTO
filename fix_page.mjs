import fs from 'fs'
let content = fs.readFileSync('app/(app)/simulados/page.tsx', 'utf8')
content = content.replace("import { supabase } from '@/lib/supabase'", "import { supabase } from '@/lib/supabase'\nimport { useApp } from '@/lib/context'")

content = content.replace("export default function SimuladosDashboard() {", `export default function SimuladosDashboard() {
  const { currentUserPerfil, currentUser, hydrated } = useApp()
  const isProfessor = currentUserPerfil === 'Professor'`)

content = content.replace("  useEffect(() => {", `  useEffect(() => {
    if (!hydrated) return`)

content = content.replace(/async function loadStats\(\) \{[\s\S]*?\}\n    loadStats\(\)/, `async function loadStats() {
      if (isProfessor && currentUser) {
        // Professor Stats
        const { data: requisicoes } = await supabase.from('simulados_requisicoes').select('id, id_simulado, status').eq('id_professor', currentUser.id)
        const totalPendentes = requisicoes?.filter(r => r.status === 'pendente').length || 0
        const simuladosIds = [...new Set(requisicoes?.map(r => r.id_simulado))]
        
        const { count: cQuestoes } = await supabase.from('simulados_questoes').select('*', { count: 'exact', head: true }).eq('id_professor', currentUser.id)
        
        setStats({
          provasAtivas: simuladosIds.length,
          questoesBanco: cQuestoes || 0,
          requisicoesPendentes: totalPendentes,
          bimestreAtual: 'N/A' // Not super relevant for professor home, but we can leave it
        })

        if (simuladosIds.length > 0) {
          const { data: rec } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome)').in('id', simuladosIds).order('created_at', { ascending: false }).limit(4)
          if (rec) setRecentes(rec)
        } else {
          setRecentes([])
        }
      } else {
        // Admin Stats
        const { count: cProvas } = await supabase.from('simulados').select('*', { count: 'exact', head: true })
        const { count: cQuestoes } = await supabase.from('simulados_questoes').select('*', { count: 'exact', head: true })
        const { count: cReq } = await supabase.from('simulados_requisicoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente')
        const { data: bim } = await supabase.from('simulados_bimestres').select('nome').eq('status', 'ativo').limit(1).maybeSingle()

        setStats({
          provasAtivas: cProvas || 0,
          questoesBanco: cQuestoes || 0,
          requisicoesPendentes: cReq || 0,
          bimestreAtual: bim?.nome || 'Não definido'
        })

        const { data: rec } = await supabase.from('simulados').select('id, titulo, status, data_aplicacao, simulados_bimestres(nome)').order('created_at', { ascending: false }).limit(4)
        if (rec) setRecentes(rec)
      }

      setLoading(false)
    }
    loadStats()`)

content = content.replace("  const cards = [", `  if (!hydrated) return null

  const cardsAdmin = [
    { title: 'Total de Provas', value: stats.provasAtivas.toString(), icon: <PenTool size={24} color="#f43f5e" />, link: '/simulados/lista' },
    { title: 'Questões no Banco', value: stats.questoesBanco.toString(), icon: <FileText size={24} color="#3b82f6" />, link: '/simulados/lista' },
    { title: 'Requisições Pendentes', value: stats.requisicoesPendentes.toString(), icon: <AlertCircle size={24} color="#f59e0b" />, link: '/simulados/gerenciamento' },
    { title: 'Bimestre Atual', value: stats.bimestreAtual, icon: <Calendar size={24} color="#10b981" />, link: '/simulados/cadastros/bimestres' },
  ]

  const cardsProfessor = [
    { title: 'Provas Pendentes', value: stats.requisicoesPendentes.toString(), icon: <AlertCircle size={24} color="#f59e0b" />, link: '/simulados/lista' },
    { title: 'Minhas Questões', value: stats.questoesBanco.toString(), icon: <FileText size={24} color="#3b82f6" />, link: '/simulados/lista' },
    { title: 'Total de Provas Vinculadas', value: stats.provasAtivas.toString(), icon: <PenTool size={24} color="#f43f5e" />, link: '/simulados/lista' },
  ]

  const cards = isProfessor ? cardsProfessor : cardsAdmin`)

content = content.replace("<h3 style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 20 }}>Simulados Recentes</h3>", `<h3 style={{ fontSize: 20, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 20 }}>{isProfessor ? 'Meus Trabalhos Pendentes' : 'Simulados Recentes'}</h3>`)

fs.writeFileSync('app/(app)/simulados/page.tsx', content)
