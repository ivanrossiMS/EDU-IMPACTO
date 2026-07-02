'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

import { useState, useMemo } from 'react'
import { useData, Funcionario, newId } from '@/lib/dataContext'
import { formatCurrency, getInitials } from '@/lib/utils'
import { ConfirmModal, EmptyState } from '@/components/ui/CrudModal'
import * as XLSX from 'xlsx'
import {
  UserPlus, Download, Search, Pencil, Trash2, X, Check,
  User, Briefcase, FileText, Phone, BadgeCheck, Building2, ChevronDown, Upload, Shield
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
  bonus: 0, valeTransporte: false,
  pis: '', banco: '', agencia: '', conta: '', observacoes: '',
  perfilSistema: '', // Perfil de acesso do sistema (configuracoes/usuarios)
  horario: {
    Dom: { in: '', out1: '', in2: '', out: '' },
    Seg: { in: '08:00', out1: '12:00', in2: '13:00', out: '17:00' },
    Ter: { in: '08:00', out1: '12:00', in2: '13:00', out: '17:00' },
    Qua: { in: '08:00', out1: '12:00', in2: '13:00', out: '17:00' },
    Qui: { in: '08:00', out1: '12:00', in2: '13:00', out: '17:00' },
    Sex: { in: '08:00', out1: '12:00', in2: '13:00', out: '17:00' },
    Sab: { in: '', out1: '', in2: '', out: '' },
  }
}

type FormData = typeof BLANK_FORM

export default function FuncionariosPage() {
  const { mantenedores = [], logSystemAction, perfis } = useData();
  const [funcionariosRaw, setFuncionarios, { loading: isLoading }] = useSupabaseArray<any>('rh/funcionarios');
  const funcionarios = funcionariosRaw || [];

  // Unidades do sistema
  const unidades = useMemo(() =>
    (mantenedores || []).flatMap(m => (m.unidades || []).map((u: any) => u.nomeFantasia || u.razaoSocial)), [mantenedores])

  // Departamentos que realmente possuem funcionários
  const departamentosAtivos = useMemo(() => {
    const deps = (funcionarios || []).map((f: any) => f.departamento).filter(Boolean)
    return Array.from(new Set(deps)).sort() as string[]
  }, [funcionarios])


  const [search, setSearch] = useState('')
  const [filtroSt, setFiltroSt] = useState('Todos')
  const [filtroDep, setFiltroDep] = useState('Todos')
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [importModal, setImportModal] = useState(false)
  const [aba, setAba] = useState<'pessoal' | 'profissional' | 'documentos' | 'contato'>('pessoal')
  const [form, setForm] = useState<FormData>({ ...BLANK_FORM })

  const calcularHorasDia = (h: { in: string; out1: string; in2: string; out: string }) => {
    if (!h.in || !h.out) return 0
    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h + m / 60
    }
    const t1 = parseTime(h.in)
    const t2 = h.out1 ? parseTime(h.out1) : t1
    const t3 = h.in2 ? parseTime(h.in2) : t2
    const t4 = parseTime(h.out)
    
    const p1 = t2 - t1
    const p2 = t4 - t3
    return Math.max(0, p1 + p2)
  }

  const totalSemana = useMemo(() => {
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].reduce((acc, dia) => {
      const h = (form as any).horario?.[dia] || { in: '', out1: '', in2: '', out: '' }
      return acc + calcularHorasDia(h)
    }, 0)
  }, [form.horario])

  const handleHorarioChange = (dia: string, campo: string, valor: string) => {
    setForm(prev => {
      const horario = { ...(prev.horario || {}) } as any
      horario[dia] = { ...(horario[dia] || { in: '', out1: '', in2: '', out: '' }), [campo]: valor }
      return { ...prev, horario }
    })
  }
  const [isSaving, setIsSaving] = useState(false)
  const [userCreateResult, setUserCreateResult] = useState<{ok: boolean; msg: string} | null>(null)

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
      valeTransporte: (f as any).valeTransporte || false,
      pis: (f as any).pis || '', banco: (f as any).banco || '',
      agencia: (f as any).agencia || '', conta: (f as any).conta || '',
      observacoes: (f as any).observacoes || '',
      perfilSistema: (f as any).perfilSistema || '',
      horario: (f as any).horario || BLANK_FORM.horario,
    })
    setEditingId(f.id); setModal('edit'); setAba('pessoal')
  }
  const closeModal = () => { setModal(null); setEditingId(null); setUserCreateResult(null) }

  const handleSave = async () => {
    if (!form.nome.trim() || isSaving) return

    // Outer Guard - Name
    if (modal === 'add' && funcionarios.some(f => f.nome.toLowerCase() === form.nome.trim().toLowerCase())) {
      alert('Já existe um funcionário com este nome!')
      return
    }

    // Outer Guard - Email
    if (form.email.trim()) {
      const emailLower = form.email.trim().toLowerCase();
      const isDuplicateEmail = funcionarios.some(f => 
        (modal === 'add' ? true : f.id !== editingId) && 
        f.email && f.email.trim().toLowerCase() === emailLower
      );
      if (isDuplicateEmail) {
        alert('Este e-mail já está sendo utilizado por outro funcionário!')
        return
      }
    }

    setIsSaving(true)
    setUserCreateResult(null)
    const payload = { ...form }

    if (modal === 'add') {
      const generatedId = newId('F')
      setFuncionarios(prev => {
        const safePrev = prev || []
        // Inner Guard
        if (safePrev.some(f => f.nome.toLowerCase() === form.nome.trim().toLowerCase() || f.id === generatedId)) return safePrev
        const next = [...safePrev, { ...payload, id: generatedId } as any]
        logSystemAction('RH (Funcionários)', 'Cadastro', `Contratação: ${payload.nome} (${payload.cargo})`, { registroId: form.codigo, nomeRelacionado: form.nome, detalhesDepois: payload })
        return next
      })
    } else if (editingId) {
      const funcAntigo = funcionarios.find(f => f.id === editingId)
      setFuncionarios(prev => prev.map(f => f.id === editingId ? { ...f, ...payload } as any : f))
      logSystemAction('RH (Funcionários)', 'Edição', `Atualização do cadastro de ${payload.nome}`, { registroId: form.codigo, nomeRelacionado: form.nome, detalhesAntes: funcAntigo, detalhesDepois: payload })
    }

    // --- Auto-create / update system user if perfilSistema is selected ---
    const pSistema = (payload as any).perfilSistema
    if (pSistema && form.email.trim()) {
      // Notification that access will be configured automatically by the background sync
      setUserCreateResult({ ok: true, msg: `✅ Acesso ao sistema será sincronizado! Login: ${form.email.trim()} · Perfil: ${pSistema}` })
      setIsSaving(false)
      // Don't close modal immediately — show result to user
      return
    }

    setIsSaving(false)
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
      'Unidade': 'Unidade Matriz',
      'CPF': '000.000.000-00',
      'RG': '00.000.000-0',
      'DataNascimento': '1990-05-20',
      'Telefone': '(11) 3000-0000',
      'Celular': '(11) 99000-0000',
      'TipoContrato': 'CLT',
      'Escolaridade': 'Graduação',
      'CargaHoraria': 40,
      'Bonus': 0,
      'PIS': '000.00000.00-0',
      'Banco': '001 — Banco do Brasil',
      'Agencia': '0001-5',
      'Conta': '12345-6',
      'Observacoes': 'Histórico relevante',
      'PerfilSistema': 'Professor'
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
          cpf: r['CPF'] || '',
          rg: r['RG'] || '',
          dataNascimento: r['DataNascimento'] || '',
          telefone: r['Telefone'] || '',
          celular: r['Celular'] || '',
          tipoContrato: r['TipoContrato'] || 'CLT',
          escolaridade: r['Escolaridade'] || 'Graduação',
          cargaHoraria: parseFloat(r['CargaHoraria']) || 40,
          bonus: parseFloat(r['Bonus']) || 0,
          pis: r['PIS'] || '',
          banco: r['Banco'] || '',
          agencia: r['Agencia'] || '',
          conta: r['Conta'] || '',
          observacoes: r['Observacoes'] || '',
          perfilSistema: r['PerfilSistema'] || '',
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
            {departamentosAtivos.map(d => <option key={d}>{d}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
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
                <th>Perfil Sistema</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              <TableSkeleton rows={8} cols={9} />
            </tbody>
          </table>
        </div>
      ) : funcionarios.length === 0 ? (
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
                <th>Perfil Sistema</th>
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
                    {(() => {
                      const pMatch = (perfis || []).find((p: any) => p.nome === (f as any).perfilSistema)
                      return (f as any).perfilSistema ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 700,
                          background: `${pMatch?.cor || '#8b5cf6'}20`, color: pMatch?.cor || '#8b5cf6',
                          display: 'inline-flex', alignItems: 'center', gap: 4
                        }}>
                          <Shield size={9} />{(f as any).perfilSistema}
                        </span>
                      ) : <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>—</span>
                    })()}
                  </td>
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

                  {/* Perfil de acesso ao sistema */}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shield size={13} style={{ color: '#8b5cf6' }} />
                      Perfil de Acesso ao Sistema
                      <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 400 }}>(Configurações → Usuários → Perfis)</span>
                    </label>
                    {(perfis || []).length === 0 ? (
                      <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px dashed rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.04)', fontSize: 12, color: '#f59e0b' }}>
                        ⚠ Nenhum perfil cadastrado. Acesse <strong>Configurações → Usuários → Perfis</strong> para criar.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {/* Option: sem perfil */}
                        <label style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${!(form as any).perfilSistema ? 'rgba(99,102,241,0.4)' : 'hsl(var(--border-subtle))'}`,
                          background: !(form as any).perfilSistema ? 'rgba(99,102,241,0.04)' : 'transparent',
                        }}>
                          <input type="radio" name="perfilSistema" checked={!(form as any).perfilSistema}
                            onChange={() => set('perfilSistema', '')}
                            style={{ accentColor: '#6366f1' }} />
                          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Sem acesso ao sistema</span>
                        </label>
                        {(perfis || []).map((p: any) => (
                          <label key={p.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${(form as any).perfilSistema === p.nome ? (p.cor || '#8b5cf6') + '60' : 'hsl(var(--border-subtle))'}`,
                            background: (form as any).perfilSistema === p.nome ? (p.cor || '#8b5cf6') + '10' : 'transparent',
                            transition: 'all 0.15s',
                          }}>
                            <input type="radio" name="perfilSistema" checked={(form as any).perfilSistema === p.nome}
                              onChange={() => set('perfilSistema', p.nome)}
                              style={{ accentColor: p.cor || '#8b5cf6' }} />
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.cor || '#8b5cf6', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: (form as any).perfilSistema === p.nome ? (p.cor || '#8b5cf6') : 'hsl(var(--text-primary))' }}>{p.nome}</div>
                              {p.descricao && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{p.descricao}</div>}
                            </div>
                            {(form as any).perfilSistema === p.nome && <Check size={13} color={p.cor || '#8b5cf6'} />}
                          </label>
                        ))}
                      </div>
                    )}
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
                  <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Vale Transporte</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Habilitar desconto padrão de 6% sobre o salário base.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => set('valeTransporte', false)}
                        style={{ height: '32px', padding: '0 16px', background: !form.valeTransporte ? '#e2e8f0' : '#fff', color: !form.valeTransporte ? '#475569' : '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                      >
                        Não
                      </button>
                      <button 
                        onClick={() => set('valeTransporte', true)}
                        style={{ height: '32px', padding: '0 16px', background: form.valeTransporte ? '#2563eb' : '#fff', color: form.valeTransporte ? '#fff' : '#94a3b8', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                      >
                        Sim
                      </button>
                    </div>
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

                  {/* Horário de Trabalho */}
                  <div style={{ gridColumn: '1/-1', marginTop: 16 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>Horário de Trabalho</label>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                            <th style={{ textAlign: 'left', padding: '6px' }}>Dia</th>
                            <th style={{ textAlign: 'left', padding: '6px' }}>Início</th>
                            <th style={{ textAlign: 'left', padding: '6px' }}>Almoço</th>
                            <th style={{ textAlign: 'left', padding: '6px' }}>Retorno</th>
                            <th style={{ textAlign: 'left', padding: '6px' }}>Saída</th>
                            <th style={{ textAlign: 'right', padding: '6px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(dia => {
                            const h = (form as any).horario?.[dia] || { in: '', out1: '', in2: '', out: '' }
                            const totalDia = calcularHorasDia(h)
                            return (
                              <tr key={dia} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                                <td style={{ padding: '6px', fontWeight: 700 }}>{dia}</td>
                                <td style={{ padding: '6px' }}><input type="time" className="form-input" style={{ padding: 4, height: 28 }} value={h.in} onChange={e => handleHorarioChange(dia, 'in', e.target.value)} /></td>
                                <td style={{ padding: '6px' }}><input type="time" className="form-input" style={{ padding: 4, height: 28 }} value={h.out1} onChange={e => handleHorarioChange(dia, 'out1', e.target.value)} /></td>
                                <td style={{ padding: '6px' }}><input type="time" className="form-input" style={{ padding: 4, height: 28 }} value={h.in2} onChange={e => handleHorarioChange(dia, 'in2', e.target.value)} /></td>
                                <td style={{ padding: '6px' }}><input type="time" className="form-input" style={{ padding: 4, height: 28 }} value={h.out} onChange={e => handleHorarioChange(dia, 'out', e.target.value)} /></td>
                                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: totalDia > 0 ? '#34d399' : 'hsl(var(--text-muted))' }}>{totalDia.toFixed(2)}h</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
                      <div>
                        <strong>Total Semana:</strong> {totalSemana.toFixed(2)}h
                      </div>
                      <div>
                        <strong>Total Mês (Fator 5):</strong> {(totalSemana * 5).toFixed(2)}h
                      </div>
                    </div>
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

            {/* System user creation result banner */}
            {userCreateResult && (
              <div style={{
                margin: '0 28px 0',
                padding: '12px 16px',
                borderRadius: 10,
                background: userCreateResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${userCreateResult.ok ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
                fontSize: 13,
                color: userCreateResult.ok ? '#10b981' : '#f59e0b',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ flex: 1 }}>{userCreateResult.msg}</span>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'hsl(var(--bg-elevated))', flexShrink: 0 }}>
              {userCreateResult ? (
                <button className="btn btn-primary" onClick={closeModal}>
                  <Check size={14} /> Concluído — Fechar
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={closeModal} disabled={isSaving}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={!form.nome.trim() || isSaving}
                    style={{ opacity: isSaving ? 0.7 : 1 }}>
                    {isSaving
                      ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Criando acesso...</>
                      : <><Check size={14} />{modal === 'add' ? (form as any).perfilSistema ? 'Cadastrar + Criar Acesso' : 'Cadastrar Funcionário' : 'Salvar Alterações'}</>
                    }
                  </button>
                </>
              )}
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
                  {['Nome', 'Cargo', 'Departamento', 'Salario', 'Email', 'Admissao', 'Unidade', 'CPF', 'TipoContrato', 'PIS', 'Banco'].map(col => (
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
