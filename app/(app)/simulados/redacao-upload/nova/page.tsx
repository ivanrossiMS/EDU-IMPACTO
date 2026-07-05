'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Save, Plus, Trash2, BookOpen, Calendar, Users, Upload, Sparkles, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'

export default function NovaRedaçãoUploadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const adaptarDe = searchParams.get('adaptar_de')
  const { currentUser } = useApp()
  const [loading, setLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [orientacoesAlunos, setOrientacoesAlunos] = useState(`Atenção às orientações:
• Deve ser realizada exclusivamente a caneta azul ou preta.
• Preencha corretamente nome completo.
• Não é permitido o uso de corretivo, celular ou outros dispositivos.
• Respostas ilegíveis ou com rasuras poderão ser desconsideradas.`)
  const [dataAplicacao, setDataAplicacao] = useState('')
  const [bimestreId, setBimestreId] = useState('')
  const [series, setSeries] = useState<string[]>([])
  const [instrucoes, setInstrucoes] = useState('')
  const [dataLimiteUpload, setDataLimiteUpload] = useState('')
  const [valor, setValor] = useState('')

  // Assignments per teacher/discipline
  const [assignments, setAssignments] = useState([
    { id: Date.now().toString(), disciplinaId: '', disciplinaNome: '', professorId: '', professorNome: '', qtdQuestoes: 10 }
  ])

  // Loaded data
  const [bimestres, setBimestres] = useState<any[]>([])
  const [disciplinas, setDisciplinas] = useState<any[]>([])
  const [professores, setProfessores] = useState<any[]>([])

  const seriesOptions = ['1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF', '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF', '1ª Série EM', '2ª Série EM', '3ª Série EM']

  useEffect(() => {
    async function load() {
      const [bimRes, discRes] = await Promise.all([
        (supabase as any).from('simulados_bimestres').select('*').eq('status', 'ativo').order('nome'),
        (supabase as any).from('simulados_disciplinas').select('*').order('nome'),
      ])
      setBimestres(bimRes.data || [])
      setDisciplinas(discRes.data || [])

      try {
        const res = await fetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
        if (res.ok) {
          const json = await res.json()
          const data = json.data || json
          setProfessores(data.filter((u: any) => u.perfil === 'Professor' && u.status === 'ativo'))
        }
      } catch (e) {}

      if (adaptarDe) {
        const { data: oldRedacao } = await (supabase as any).from('redacao_upload').select('*').eq('id', adaptarDe).single()
        if (oldRedacao) {
          setTitulo((oldRedacao.titulo || '') + ' - Adaptado')
          if (oldRedacao.descricao) setDescricao(oldRedacao.descricao)
          if (oldRedacao.data_aplicacao) setDataAplicacao(oldRedacao.data_aplicacao)
          if (oldRedacao.id_bimestre) setBimestreId(oldRedacao.id_bimestre)
          if (oldRedacao.series) setSeries(Array.isArray(oldRedacao.series) ? oldRedacao.series : [oldRedacao.series])
          if (oldRedacao.data_limite_upload) setDataLimiteUpload(oldRedacao.data_limite_upload)
          if (oldRedacao.valor) setValor(oldRedacao.valor.toString())
          
          const { data: reqs } = await (supabase as any).from('redacao_upload_requisicoes').select('*').eq('id_redacao_upload', adaptarDe)
          if (reqs && reqs.length > 0) {
            setAssignments(reqs.map((r: any) => ({
              id: Date.now().toString() + Math.random(),
              disciplinaId: r.id_disciplina || '',
              disciplinaNome: r.disciplina_nome || '',
              professorId: r.id_professor || '',
              professorNome: r.professor_nome || '',
              qtdQuestoes: r.qtd_questoes || 10
            })))
          }
        }
      }
    }
    load()
  }, [adaptarDe])

  const toggleSerie = (s: string) => setSeries(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const addAssignment = () => setAssignments(prev => [...prev, {
    id: Date.now().toString(), disciplinaId: '', disciplinaNome: '', professorId: '', professorNome: '', qtdQuestoes: 10
  }])

  const removeAssignment = (id: string) => setAssignments(prev => prev.filter(a => a.id !== id))

  const updateAssignment = (id: string, field: string, value: any) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== id) return a
      const updated: any = { ...a, [field]: value }
      if (field === 'disciplinaId') {
        const disc = disciplinas.find(d => d.id === value)
        if (disc) {
          updated.disciplinaNome = disc.nome
          if (disc.quantidade_questoes) updated.qtdQuestoes = disc.quantidade_questoes
          // Auto-populate professor
          let ids: string[] = []
          if (Array.isArray(disc.professores_ids)) ids = disc.professores_ids
          else if (typeof disc.professores_ids === 'string') {
            try { ids = JSON.parse(disc.professores_ids) } catch {}
          } else if (disc.id_professor) ids = [disc.id_professor]
          if (ids.length > 0) {
            const prof = professores.find(p => ids.includes(p.id))
            if (prof) { updated.professorId = prof.id; updated.professorNome = prof.nome }
          }
        }
      }
      if (field === 'professorId') {
        const prof = professores.find(p => p.id === value)
        if (prof) updated.professorNome = prof.nome
      }
      return updated
    }))
  }

  const handleSave = async () => {
    if (!titulo.trim()) { alert('Informe o título da redacao.'); return }
    if (series.length === 0) { alert('Selecione ao menos uma série.'); return }
    if (assignments.some(a => !a.disciplinaId || !a.professorId)) {
      alert('Preencha disciplina e professor em todas as atribuições.'); return
    }

    setLoading(true)
    try {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        instrucoes: orientacoesAlunos.trim() || null,
        data_aplicacao: dataAplicacao || null,
        data_limite_upload: dataLimiteUpload || null,
        id_bimestre: bimestreId || null,
        series,
        valor: valor ? parseFloat(valor.replace(',', '.')) : null,
        status: 'aguardando',
        questoes_count: 0,
        criado_por: currentUser?.id || null,
        updated_at: new Date().toISOString()
      }

      const { data: redacaoData, error: redacaoError } = await (supabase as any)
        .from('redacao_upload')
        .insert([payload])
        .select()
        .single()

      if (redacaoError) throw redacaoError

      // Create assignments (requisitions)
      const reqs = assignments.map(a => ({
        id_redacao_upload: redacaoData.id,
        id_disciplina: a.disciplinaId,
        disciplina_nome: a.disciplinaNome,
        id_professor: a.professorId,
        professor_nome: a.professorNome,
        qtd_questoes: Number.isNaN(a.qtdQuestoes) ? 10 : a.qtdQuestoes,
        status: 'pendente',
      }))

      const { error: reqError } = await (supabase as any).from('redacao_upload_requisicoes').insert(reqs)
      if (reqError) throw reqError

      // Remove the direct alert and router.push here, trigger state instead
      setSuccessModal(true)
    } catch (e: any) {
      console.error(e)
      alert('Erro ao criar redacao: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    background: 'hsl(var(--bg-app))', border: '1px solid hsl(var(--border-subtle))',
    color: 'hsl(var(--text-primary))', fontSize: 15, outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', color: 'hsl(var(--text-secondary))',
    fontSize: 12, fontWeight: 700, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: '0.06em'
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/simulados/redacao-upload"
              style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))', textDecoration: 'none' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>Nova Redação via Upload</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, fontSize: 14 }}>Defina os detalhes e atribuições para os professores enviarem</p>
            </div>
          </div>
          <motion.button
            onClick={handleSave} disabled={loading}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 700, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: 14, boxShadow: '0 8px 20px rgba(139,92,246,0.35)' }}
          >
            <Save size={18} /> {loading ? 'Criando...' : 'Criar Redação'}
          </motion.button>
        </div>

        {/* ── Section 1: Basic Info ── */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, marginBottom: 24 }}>
          <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 16, fontWeight: 700, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="#8b5cf6" /> Informações da Redação
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Título da Redação *</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Simulado Geral — 2º Bimestre 2025" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instruções para os Professores</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Envie temas para a redação..." rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Orientações para os Alunos</label>
              <textarea value={orientacoesAlunos} onChange={e => setOrientacoesAlunos(e.target.value)} placeholder="Ex: Preencha o cabeçalho, use caneta azul ou preta..." rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={labelStyle}>Bimestre</label>
              <select value={bimestreId} onChange={e => setBimestreId(e.target.value)} style={inputStyle}>
                <option value="">Nenhum / Geral</option>
                {bimestres.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Data de Aplicação</label>
              <input type="date" value={dataAplicacao} onChange={e => setDataAplicacao(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Prazo para Upload dos Professores</label>
              <input type="date" value={dataLimiteUpload} onChange={e => setDataLimiteUpload(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* ── Section 2: Series ── */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, marginBottom: 24 }}>
          <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 16, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#8b5cf6" /> Séries Aplicáveis *
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {seriesOptions.map(s => (
              <motion.button key={s} onClick={() => toggleSerie(s)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{ padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: series.includes(s) ? 'rgba(139,92,246,0.15)' : 'rgba(100,116,139,0.1)',
                  border: `1.5px solid ${series.includes(s) ? '#8b5cf6' : 'transparent'}`,
                  color: series.includes(s) ? '#8b5cf6' : 'hsl(var(--text-secondary))' }}>
                {s}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Section 4: Assignments ── */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 16, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={18} color="#8b5cf6" /> Atribuições por Professor
              </h3>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13, margin: 0 }}>Defina quais professores enviarão questões de quais disciplinas.</p>
            </div>
            <motion.button onClick={addAssignment} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: 13, fontWeight: 700, border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer' }}>
              <Plus size={16} /> Adicionar
            </motion.button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {assignments.map((a, i) => {
              const disc = disciplinas.find(d => d.id === a.disciplinaId)
              let allowedProfIds: string[] = []
              if (disc) {
                if (Array.isArray(disc.professores_ids)) allowedProfIds = disc.professores_ids
                else if (typeof disc.professores_ids === 'string') {
                  try { allowedProfIds = JSON.parse(disc.professores_ids) } catch {}
                } else if (disc.id_professor) allowedProfIds = [disc.id_professor]
              }
              const filteredProfs = allowedProfIds.length > 0
                ? professores.filter(p => allowedProfIds.includes(p.id))
                : professores

              return (
                <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px auto', gap: 14, alignItems: 'flex-end', background: 'hsl(var(--bg-app))', padding: '16px 20px', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Disciplina *</label>
                    <select value={a.disciplinaId} onChange={e => updateAssignment(a.id, 'disciplinaId', e.target.value)}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }}>
                      <option value="" disabled>Selecionar...</option>
                      {disciplinas.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.nome} {(d.segmento && d.segmento !== 'Sem Segmento') ? `— ${d.segmento}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Professor *</label>
                    <select value={a.professorId} onChange={e => updateAssignment(a.id, 'professorId', e.target.value)}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }}>
                      <option value="" disabled>Selecionar...</option>
                      {filteredProfs.length === 0
                        ? <option disabled>Nenhum professor vinculado</option>
                        : filteredProfs.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Qtd. Quest.</label>
                    <input type="number" min={1} max={100}
                      value={Number.isNaN(a.qtdQuestoes) ? '' : a.qtdQuestoes}
                      onChange={e => updateAssignment(a.id, 'qtdQuestoes', parseInt(e.target.value))}
                      style={{ ...inputStyle, padding: '10px 12px', fontSize: 14, textAlign: 'center' }} />
                  </div>
                  <div>
                    <motion.button onClick={() => removeAssignment(a.id)} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} disabled={assignments.length === 1}
                      style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: assignments.length === 1 ? 'not-allowed' : 'pointer', opacity: assignments.length === 1 ? 0.3 : 1 }}>
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

      </motion.div>

      <AnimatePresence>
        {successModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
            
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 420, position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', textAlign: 'center' }}>
              
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={32} color="#10b981" />
              </div>
              
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: '0 0 12px' }}>Redação Criada!</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, lineHeight: 1.5, margin: '0 0 32px' }}>
                A redacao foi criada com sucesso. Os professores vinculados já podem acessar e enviar as questões.
              </p>
              
              <motion.button onClick={() => router.push('/simulados/redacao-upload')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(16,185,129,0.3)' }}>
                Continuar
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
