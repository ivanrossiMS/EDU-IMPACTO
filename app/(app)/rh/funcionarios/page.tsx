'use client'

import { useState, useMemo } from 'react'
import { useData, Funcionario, newId } from '@/lib/dataContext'
import { formatCurrency, getInitials } from '@/lib/utils'
import { ConfirmModal, EmptyState } from '@/components/ui/CrudModal'
import * as XLSX from 'xlsx'
import {
  UserPlus, Download, Search, Pencil, Trash2, X, Check,
  User, Briefcase, FileText, Phone, BadgeCheck, Building2, ChevronDown, Upload
} from 'lucide-react'

const CARGOS = ['Professor', 'Professora', 'Coordenador(a) Pedagógico(a)', 'Diretor(a)', 'Vice-Diretor(a)', 'Secretária', 'Psicólogo(a)', 'Fonoaudiólogo(a)', 'Auxiliar Administrativo', 'Assistente de TI', 'Motorista', 'Auxiliar de Serviços Gerais', 'Nutricionista', 'Outro']
const DEPARTAMENTOS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês', 'Educação Física', 'Artes', 'Pedagogia', 'Direção', 'Secretaria', 'Apoio', 'Tecnologia', 'Transporte', 'Cantina', 'Outro']
const TIPOS_CONTRATO = ['CLT', 'PJ', 'Temporário', 'Estágio', 'Autônomo']
const ESCOLARIDADES = ['Ensino Fundamental', 'Ensino Médio', 'Técnico', 'Graduação', 'Especialização', 'Mestrado', 'Doutorado']
const STATUS_OPTS = ['ativo', 'inativo', 'férias', 'afastado', 'licença']

function gerarCodFunc(total: number) {
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `FUNC-${rand}`
}

const BLANK_FORM = {
  codigo: '', nome: '', cargo: 'Professor', departamento: 'Pedagogia', salario: 0,
  status: 'ativo', email: '', admissao: new Date().toISOString().slice(0, 10),
  unidade: '',
  // extras
  cpf: '', rg: '', dataNascimento: '', telefone: '', celular: '',
  tipoContrato: 'CLT', escolaridade: 'Graduação', cargaHoraria: 40,
  bonus: 0,
  pis: '', banco: '', agencia: '', conta: '', observacoes: '',
}

type FormData = typeof BLANK_FORM

export default function FuncionariosPage() {
  const { funcionarios, setFuncionarios, mantenedores, logSystemAction } = useData()

  // Unidades do sistema
  const unidades = useMemo(() =>
    mantenedores.flatMap(m => m.unidades.map(u => u.nomeFantasia || u.razaoSocial)), [mantenedores])

  const [search, setSearch] = useState('')
  const [filtroSt, setFiltroSt] = useState('Todos')
  const [filtroDep, setFiltroDep] = useState('Todos')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [importModal, setImportModal] = useState(false)
  const [aba, setAba] = useState<'pessoal' | 'profissional' | 'documentos' | 'contato'>('pessoal')
  const [form, setForm] = useState<FormData>({ ...BLANK_FORM })

  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }))

  const filtered = useMemo(() => funcionarios.filter(f => {
    const q = search.toLowerCase()
  const searchActive = search.trim().length >= 3
    const matchSearch = !searchActive || (f.nome.toLowerCase().includes(q) || f.cargo.toLowerCase().includes(q) || (f as any).cpf?.includes(q))
    const matchSt = filtroSt === 'Todos' || f.status === filtroSt
    const matchDep = filtroDep === 'Todos' || f.departamento === filtroDep
    return matchSearch && matchSt && matchDep
  }), [funcionarios, search, filtroSt, filtroDep])

  const totalFolha = funcionarios.reduce((s, f) => s + f.salario, 0)

  const openAdd = () => {
    setForm({ ...BLANK_FORM, codigo: gerarCodFunc(funcionarios.length) })
    setEditingId(null); setModal('add'); setAba('pessoal')
  }
  const openEdit = (f: Funcionario) => {
    setForm({
      codigo: (f as any).codigo || gerarCodFunc(funcionarios.length),
      nome: f.nome, cargo: f.cargo, departamento: f.departamento,
      salario: f.salario, status: f.status, email: f.email,
      admissao: f.admissao, unidade: f.unidade,
      cpf: (f as any).cpf || '', rg: (f as any).rg || '',
      dataNascimento: (f as any).dataNascimento || '', telefone: (f as any).telefone || '',
      celular: (f as any).celular || '', tipoContrato: (f as any).tipoContrato || 'CLT',
      escolaridade: (f as any).escolaridade || 'Graduação', cargaHoraria: (f as any).cargaHoraria || 40,
      bonus: (f as any).bonus || 0,
      pis: (f as any).pis || '', banco: (f as any).banco || '',
      agencia: (f as any).agencia || '', conta: (f as any).conta || '',
      observacoes: (f as any).observacoes || '',
    })
    setEditingId(f.id); setModal('edit'); setAba('pessoal')
  }
  const closeModal = () => { setModal(null); setEditingId(null) }

  const handleSave = () => {
    if (!form.nome.trim()) return
    const payload = { ...form }
    if (modal === 'add') {
      const generatedId = newId('F')
      setFuncionarios(prev => [...prev, { ...payload, id: generatedId } as any])
      logSystemAction('RH (Funcionários)', 'Cadastro', `Contratação: ${payload.nome} (${payload.cargo})`, { registroId: form.codigo, nomeRelacionado: form.nome, detalhesDepois: payload })
    } else if (editingId) {
      const funcAntigo = funcionarios.find(f => f.id === editingId)
      setFuncionarios(prev => prev.map(f => f.id === editingId ? { ...f, ...payload } as any : f))
      logSystemAction('RH (Funcionários)', 'Edição', `Atualização do cadastro de ${payload.nome}`, { registroId: form.codigo, nomeRelacionado: form.nome, detalhesAntes: funcAntigo, detalhesDepois: payload })
    }
    closeModal()
  }

  const handleDelete = () => {
    if (confirmId) {
      const funcAntigo = funcionarios.find(f => f.id === confirmId)
      setFuncionarios(prev => prev.filter(f => f.id !== confirmId))
      logSystemAction('RH (Funcionários)', 'Exclusão', `Exclusão permanente do funcionário`, { registroId: (funcAntigo as any)?.codigo, nomeRelacionado: funcAntigo?.nome, detalhesAntes: funcAntigo })
    }
    setConfirmId(null)
  }

  const downloadModelo = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Nome': 'João da Silva',
      'Cargo': 'Professor',
      'Departamento': 'Matemática',
      'Salario': 5000.00,
      'Email': 'joao@escola.com.br',
      'Admissao': '2023-01-15',
      'Unidade': 'Unidade Matriz'
    }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Funcionarios")
    XLSX.writeFile(wb, "Modelo_Funcionarios.xlsx")
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      if (!data) return
      const wb = XLSX.read(data, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsname])

      const novosFuncs: any[] = []
      rows.forEach(r => {
        if (!r['Nome']) return
        
        // Conversão de serial do excel de datas se for numero, tratar. 
        // Aqui assumiremos que ou vem string "2023-01-15" ou numero
        let d = r['Admissao']
        if (typeof d === 'number') {
           const excelEpoch = new Date(Date.UTC(1899, 11, 30))
           const dateInfo = new Date(excelEpoch.getTime() + d * 86400000)
           d = dateInfo.toISOString().split('T')[0]
        } else if (typeof d === 'string' && d.includes('/')) {
           // tenta d/m/y ou d-m-y
           const partes = d.split(/[/-]/)
           if (partes.length === 3) d = `${partes[2]}-${partes[1]}-${partes[0]}`
        }

        novosFuncs.push({
          id: newId('F'),
          codigo: gerarCodFunc(funcionarios.length + novosFuncs.length),
          nome: r['Nome'] || '',
          cargo: r['Cargo'] || 'Outro',
          departamento: r['Departamento'] || 'Outro',
          salario: parseFloat(r['Salario']) || 0,
          email: r['Email'] || '',
          admissao: d || new Date().toISOString().split('T')[0],
          unidade: r['Unidade'] || '',
          status: 'ativo',
          tipoContrato: 'CLT',
          escolaridade: 'Ensino Médio',
          cargaHoraria: 40
        })
      })

      if (novosFuncs.length > 0) {
        setFuncionarios(prev => [...prev, ...novosFuncs])
        logSystemAction('RH (Funcionários)', 'Importação', `Importação de ${novosFuncs.length} funcionários via planilha`, { detalhesDepois: novosFuncs.map(nf => nf.nome) })
      }
      setImportModal(false)
    }
    reader.readAsBinaryString(file)
  }

  const ABAs = [
    { id: 'pessoal', label: 'Dados Pessoais', icon: <User size={14} /> },
    { id: 'profissional', label: 'Profissional', icon: <Briefcase size={14} /> },
    { id: 'documentos', label: 'Documentos', icon: <FileText size={14} /> },
    { id: 'contato', label: 'Contato & Banco', icon: <Phone size={14} /> },
  ]

  const STATUS_COLOR: Record<string, string> = {
    ativo: '#10b981', inativo: '#6b7280', férias: '#3b82f6', afastado: '#f59e0b', licença: '#8b5cf6'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Funcionários & RH</h1>
          <p className="page-subtitle">{funcionarios.length} colaboradores{totalFolha > 0 ? ` • Folha mensal: ${formatCurrency(totalFolha)}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setImportModal(true)}><Upload size={13} />Importar Tabela</button>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><UserPlus size={13} />Novo Funcionário</button>
        </div>
      </div>

      {/* KPIs */}
      {funcionarios.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', value: funcionarios.length, color: '#3b82f6', icon: '👥' },
            { label: 'Folha Mensal', value: formatCurrency(totalFolha), color: '#ef4444', icon: '💰' },
            { label: 'Professores', value: funcionarios.filter(f => f.cargo.toLowerCase().includes('professor')).length, color: '#8b5cf6', icon: '🎓' },
            { label: 'Ativos', value: funcionarios.filter(f => f.status === 'ativo').length, color: '#10b981', icon: '✅' },
          ].map(c => (
            <div key={c.label} className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: typeof c.value === 'number' ? 26 : 18, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar nome, cargo, CPF..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 150 }} value={filtroSt} onChange={e => setFiltroSt(e.target.value)}>
            <option value="Todos">Todos os status</option>
            {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="form-input" style={{ width: 170 }} value={filtroDep} onChange={e => setFiltroDep(e.target.value)}>
            <option value="Todos">Todos departamentos</option>
            {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Lista */}
      {funcionarios.length === 0 ? (
        <EmptyState icon="👥" title="Nenhum funcionário cadastrado"
          description="Cadastre o primeiro colaborador para iniciar a gestão de RH."
          action={<button className="btn btn-primary" onClick={openAdd}><UserPlus size={14} /> Cadastrar Primeiro Funcionário</button>} />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Funcionário</th>
                <th>Cargo / Depto</th>
                <th>Salário</th>
                <th>Admissão</th>
                <th>Unidade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td><code style={{ fontSize: 10, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4, color: '#60a5fa' }}>{(f as any).codigo || '—'}</code></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{getInitials(f.nome)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{f.nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{f.cargo}</div>
                    <span className="badge badge-neutral" style={{ fontSize: 10, marginTop: 2 }}>{f.departamento}</span>
                  </td>
                  <td style={{ fontWeight: 800, color: '#34d399', fontFamily: 'Outfit, sans-serif' }}>{formatCurrency(f.salario)}</td>
                  <td style={{ fontSize: 12 }}>{f.admissao}</td>
                  <td style={{ fontSize: 12 }}>{f.unidade || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, fontWeight: 700, background: `${STATUS_COLOR[f.status] || '#6b7280'}20`, color: STATUS_COLOR[f.status] || '#6b7280' }}>{f.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(f)} title="Editar"><Pencil size={12} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: '#f87171' }} onClick={() => setConfirmId(f.id)} title="Excluir"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Premium */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 20, width: '100%', maxWidth: 780, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 120px rgba(0,0,0,0.7)' }}>
            {/* Header */}
            <div style={{ padding: '20px 28px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.05) 100%)', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BadgeCheck size={24} color="#60a5fa" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{modal === 'add' ? 'Novo Funcionário' : 'Editar Funcionário'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Código:</span>
                    <code style={{ fontSize: 12, fontWeight: 900, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', padding: '1px 8px', borderRadius: 4 }}>{form.codigo}</code>
                  </div>
                </div>
              </div>
              <button onClick={closeModal} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
              {ABAs.map(a => (
                <button key={a.id} onClick={() => setAba(a.id as typeof aba)}
                  style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: aba === a.id ? '2px solid #60a5fa' : '2px solid transparent', color: aba === a.id ? '#60a5fa' : 'hsl(var(--text-muted))', transition: 'all 0.15s' }}>
                  {a.icon}{a.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              {aba === 'pessoal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nome Completo *</label>
                    <input className="form-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Prof. Ricardo Faria" style={{ fontSize: 15, fontWeight: 600 }} />
                  </div>
                  <div>
                    <label className="form-label">Data de Nascimento</label>
                    <input type="date" className="form-input" value={form.dataNascimento} onChange={e => set('dataNascimento', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                      {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">E-mail *</label>
                    <input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="funcionario@escola.com" />
                  </div>
                  <div>
                    <label className="form-label">Escolaridade</label>
                    <select className="form-input" value={form.escolaridade} onChange={e => set('escolaridade', e.target.value)}>
                      {ESCOLARIDADES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {aba === 'profissional' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label">Cargo *</label>
                    <select className="form-input" value={form.cargo} onChange={e => set('cargo', e.target.value)}>
                      {CARGOS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Departamento</label>
                    <select className="form-input" value={form.departamento} onChange={e => set('departamento', e.target.value)}>
                      {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="form-label">Salário (R$) *</label>
                      <input type="number" className="form-input" value={form.salario || ''} onChange={e => set('salario', +e.target.value)} style={{ fontWeight: 800, color: '#34d399' }} min={0} step={100} />
                    </div>
                    <div>
                      <label className="form-label">Bônus / Gratificação (R$)</label>
                      <input type="number" className="form-input" value={(form as any).bonus || ''} onChange={e => set('bonus', +e.target.value)} style={{ fontWeight: 800, color: '#f59e0b' }} min={0} step={50} placeholder="0,00" />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Tipo de Contrato</label>
                    <select className="form-input" value={form.tipoContrato} onChange={e => set('tipoContrato', e.target.value)}>
                      {TIPOS_CONTRATO.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Data de Admissão</label>
                    <input type="date" className="form-input" value={form.admissao} onChange={e => set('admissao', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Carga Horária (h/semana)</label>
                    <input type="number" className="form-input" value={form.cargaHoraria} onChange={e => set('cargaHoraria', +e.target.value)} min={1} max={60} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Unidade</label>
                    {unidades.length > 0 ? (
                      <select className="form-input" value={form.unidade} onChange={e => set('unidade', e.target.value)}>
                        <option value="">Selecionar unidade</option>
                        {unidades.map(u => <option key={u}>{u}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" value={form.unidade} onChange={e => set('unidade', e.target.value)} placeholder="Unidade (configure em Administrativo)" />
                    )}
                  </div>
                </div>
              )}

              {aba === 'documentos' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label">CPF</label>
                    <input className="form-input" value={form.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="form-label">RG</label>
                    <input className="form-input" value={form.rg} onChange={e => set('rg', e.target.value)} placeholder="00.000.000-0" />
                  </div>
                  <div>
                    <label className="form-label">PIS / PASEP</label>
                    <input className="form-input" value={form.pis} onChange={e => set('pis', e.target.value)} placeholder="000.00000.00-0" />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Observações internas</label>
                    <textarea className="form-input" style={{ minHeight: 80, resize: 'vertical' }} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Histórico relevante, restrições, etc." />
                  </div>
                </div>
              )}

              {aba === 'contato' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label">Telefone</label>
                    <input className="form-input" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 3000-0000" />
                  </div>
                  <div>
                    <label className="form-label">Celular / WhatsApp</label>
                    <input className="form-input" value={form.celular} onChange={e => set('celular', e.target.value)} placeholder="(11) 99000-0000" />
                  </div>
                  <div style={{ gridColumn: '1/-1', height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />
                  <div style={{ gridColumn: '1/-1', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados Bancários (para pagamento)</div>
                  <div>
                    <label className="form-label">Banco</label>
                    <input className="form-input" value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="001 — Banco do Brasil" />
                  </div>
                  <div>
                    <label className="form-label">Agência</label>
                    <input className="form-input" value={form.agencia} onChange={e => set('agencia', e.target.value)} placeholder="0001-5" />
                  </div>
                  <div>
                    <label className="form-label">Conta Corrente</label>
                    <input className="form-input" value={form.conta} onChange={e => set('conta', e.target.value)} placeholder="12345-6" />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim()}>
                <Check size={14} />{modal === 'add' ? 'Cadastrar Funcionário' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={confirmId !== null} onClose={() => setConfirmId(null)} onConfirm={handleDelete}
        message="O funcionário será removido permanentemente." />

      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: 480, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-overlay))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Importar Planilha (XLSX, CSV)</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setImportModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.05)', borderRadius: 8, border: '1px dashed rgba(99,102,241,0.2)' }}>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginBottom: 12 }}>
                  Para importar corretamente, sua planilha deve seguir o modelo padrão com as seguintes colunas (mesmo nome no cabeçalho):
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Nome', 'Cargo', 'Departamento', 'Salario', 'Email', 'Admissao', 'Unidade'].map(col => (
                    <span key={col} style={{ padding: '2px 8px', borderRadius: 4, background: 'hsl(var(--bg-elevated))', fontSize: 11, fontWeight: 700, border: '1px solid hsl(var(--border-subtle))' }}>{col}</span>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={downloadModelo}>
                  <Download size={14} style={{ color: '#10b981' }}/> Baixar Planilha Modelo
                </button>
              </div>
              
              <div style={{ borderTop: '1px solid hsl(var(--border-subtle))', margin: '8px 0' }} />
              
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>Enviar planilha com dados</label>
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  onChange={handleImport}
                  style={{ width: '100%', padding: '12px', background: 'hsl(var(--bg-overlay))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 13 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
