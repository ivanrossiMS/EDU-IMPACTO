'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NovoSimuladoPage() {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataAplicacao, setDataAplicacao] = useState('')
  const [bimestreId, setBimestreId] = useState('')
  const [series, setSeries] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Real data
  const [bimestres, setBimestres] = useState<any[]>([])
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  const [professores, setProfessores] = useState<any[]>([])

  // Requisicoes (disciplina, professor, qtdQuestoes)
  const [requisicoes, setRequisicoes] = useState([
    { id: Date.now().toString(), disciplinaId: '', professorId: '', qtdQuestoes: 10 }
  ])

  const seriesOptions = ['6º Ano', '7º Ano', '8º Ano', '9º Ano', '1ª Série', '2ª Série', '3ª Série']

  useEffect(() => {
    async function loadData() {
      const { data: bims } = await supabase.from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome')
      setBimestres(bims || [])

      const { data: discs } = await supabase.from('simulados_disciplinas').select('*').order('nome')
      setDisciplinas(discs || [])

      try {
        const res = await fetch('/api/configuracoes/usuarios?type=colaboradores')
        if (res.ok) {
          const json = await res.json()
          const data = json.data || json
          setProfessores(data.filter((u: any) => u.perfil === 'Professor' && u.status === 'ativo'))
        }
      } catch(e) {}
    }
    loadData()
  }, [])

  const handleAddRequisicao = () => {
    setRequisicoes(prev => [...prev, { id: Date.now().toString(), disciplinaId: '', professorId: '', qtdQuestoes: 10 }])
  }

  const handleRemoveRequisicao = (id: string) => {
    setRequisicoes(prev => prev.filter(r => r.id !== id))
  }

  const handleRequisicaoChange = (id: string, field: string, value: string | number) => {
    setRequisicoes(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value }
        // Se mudou a disciplina, auto-preencher professor e qtdQuestoes
        if (field === 'disciplinaId') {
          const disc = disciplinas.find(d => d.id === value)
          if (disc) {
            if (disc.id_professor) updated.professorId = disc.id_professor
            if (disc.quantidade_questoes) updated.qtdQuestoes = disc.quantidade_questoes
          }
        }
        return updated
      }
      return r
    }))
  }

  const toggleSerie = (serie: string) => {
    setSeries(prev => prev.includes(serie) ? prev.filter(s => s !== serie) : [...prev, serie])
  }

  const handleSave = async () => {
    if (!titulo || !dataAplicacao || requisicoes.some(r => !r.disciplinaId || !r.professorId)) {
      alert('Preencha todos os campos obrigatórios e as requisições.')
      return
    }

    setLoading(true)
    try {
      const { data: simData, error: simError } = await supabase.from('simulados').insert([{
        titulo,
        data_aplicacao: dataAplicacao,
        id_bimestre: bimestreId || null,
        turmas: series,
        status: 'rascunho'
      }]).select().single()

      if (simError) throw simError

      if (requisicoes.length > 0) {
        const reqs = requisicoes.map(r => ({
          id_simulado: simData.id,
          id_disciplina: r.disciplinaId,
          id_professor: r.professorId,
          quantidade_questoes: r.qtdQuestoes,
          status: 'pendente'
        }))
        const { error: reqError } = await supabase.from('simulados_requisicoes').insert(reqs)
        if (reqError) throw reqError
      }
      
      alert('Simulado criado com sucesso! Requisições prontas.')
      router.push('/simulados/gerenciamento')
    } catch (err) {
      console.error(err)
      alert('Erro ao criar simulado: ' + ((err as any).message || JSON.stringify(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/simulados/gerenciamento" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100, 116, 139, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', textDecoration: 'none' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>Novo Simulado</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, fontSize: 14 }}>Planejamento e requisição de questões</p>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={loading}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', 
              borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', 
              color: '#fff', fontWeight: 700, border: 'none', cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            <Save size={18} />
            {loading ? 'Criando...' : 'Criar e Requisitar'}
          </button>
        </div>

        {/* Formulário Principal */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, marginBottom: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título do Simulado</label>
              <input 
                type="text" 
                value={titulo} 
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Simulado Geral 2º Bimestre"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data de Aplicação</label>
              <input 
                type="date" 
                value={dataAplicacao} 
                onChange={e => setDataAplicacao(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bimestre</label>
              <select 
                value={bimestreId} 
                onChange={e => setBimestreId(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none' }}
              >
                <option value="">Nenhum/Geral</option>
                {bimestres.map(b => (
                  <option key={b.id} value={b.id}>{b.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Séries Aplicáveis</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {seriesOptions.map(serie => (
                  <button
                    key={serie}
                    onClick={() => toggleSerie(serie)}
                    style={{
                      padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: series.includes(serie) ? 'rgba(59,130,246,0.15)' : 'rgba(100, 116, 139, 0.1)',
                      border: `1px solid ${series.includes(serie) ? '#3b82f6' : 'transparent'}`,
                      color: series.includes(serie) ? '#3b82f6' : 'hsl(var(--text-secondary))',
                      transition: 'all 0.2s'
                    }}
                  >
                    {serie}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Requisições */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Requisições de Questões</h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: 0 }}>Delegue a criação de questões para os professores.</p>
            </div>
            <button 
              onClick={handleAddRequisicao}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(100, 116, 139, 0.1)', color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {requisicoes.map((req, i) => (
              <div key={req.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: 16, alignItems: 'center', background: 'hsl(var(--bg-app))', padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Disciplina</label>
                  <select 
                    value={req.disciplinaId} 
                    onChange={e => handleRequisicaoChange(req.id, 'disciplinaId', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }}
                  >
                    <option value="" disabled>Selecionar...</option>
                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Professor Responsável</label>
                  <select 
                    value={req.professorId} 
                    onChange={e => handleRequisicaoChange(req.id, 'professorId', e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none' }}
                  >
                    <option value="" disabled>Selecionar...</option>
                    {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'hsl(var(--text-secondary))', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Quant.</label>
                  <input 
                    type="number" 
                    min="1"
                    value={req.qtdQuestoes} 
                    onChange={e => handleRequisicaoChange(req.id, 'qtdQuestoes', parseInt(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none', textAlign: 'center' }}
                  />
                </div>

                <div style={{ paddingTop: 18 }}>
                  <button 
                    onClick={() => handleRemoveRequisicao(req.id)}
                    style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  )
}
