'use client'

import React from 'react'
import { ConfigConvenio, Titulo } from '@/lib/dataContext'
import { openBoletoHtml } from '@/lib/banking/openBoletoHtml'
import { User, Building2, MapPin, FileText, DollarSign, Calendar, Info, Printer, RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react'

interface Props {
  convenios: ConfigConvenio[]
  onEmitido: (titulo: Titulo, novoSeq: number, convenioId: string) => void
  onNavigate?: (aba: string) => void
}

interface FormAvulso {
  tipoDoc: 'cpf' | 'cnpj'
  nome: string; cpfCnpj: string
  logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; cep: string
  convenioId: string; descricao: string; numeroDocumento: string
  especie: string; aceite: string; dataDocumento: string; dataVencimento: string
  valor: string; percJuros: string; percMulta: string; desconto: string
  dataLimiteDesconto: string; abatimento: string
  instrucao1: string; instrucao2: string; tipoProtesto: string; diasProtesto: string; competencia: string
}

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const maskCPF  = (v: string) => v.replace(/\D/g,'').slice(0,11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')
const maskCNPJ = (v: string) => v.replace(/\D/g,'').slice(0,14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')
const maskCEP  = (v: string) => v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d{3})/,'$1-$2')
const fmt      = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })

const INITIAL: FormAvulso = {
  tipoDoc:'cpf', nome:'', cpfCnpj:'', logradouro:'', numero:'', complemento:'',
  bairro:'', cidade:'', uf:'SP', cep:'',
  convenioId:'', descricao:'', numeroDocumento:'', especie:'DS', aceite:'N',
  dataDocumento: new Date().toISOString().slice(0,10),
  dataVencimento: new Date(Date.now() + 7*86400000).toISOString().slice(0,10),
  valor:'', percJuros:'0.033', percMulta:'2', desconto:'0',
  dataLimiteDesconto:'', abatimento:'0',
  instrucao1:'',
  instrucao2:'', tipoProtesto:'0', diasProtesto:'0',
  competencia: new Date().toISOString().slice(0,7),
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:12, borderBottom:'1px solid hsl(var(--border-subtle))' }}>
        <span style={{ color:'#3b82f6' }}>{icon}</span>
        <span style={{ fontWeight:700, fontSize:13 }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Campo({ label, children, required, hint }: { label:string; children:React.ReactNode; required?:boolean; hint?:string }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>
        {label}{required && <span style={{ color:'#f87171', marginLeft:2 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:3 }}>{hint}</div>}
    </div>
  )
}

export function AbaEmitirAvulso({ convenios, onEmitido, onNavigate }: Props) {
  const [form, setForm]         = React.useState<FormAvulso>({ ...INITIAL })
  const [erros, setErros]       = React.useState<string[]>([])
  const [loading, setLoading]   = React.useState(false)
  const [gerado, setGerado]     = React.useState<Titulo | null>(null)

  const convAtivos = convenios.filter(c => c.situacao === 'ativo')

  // Preenche convênio padrão quando lista muda
  React.useEffect(() => {
    if (!form.convenioId && convAtivos.length > 0)
      setForm(f => ({ ...f, convenioId: convAtivos[0].id }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convAtivos.length])

  const convenio = convAtivos.find(c => c.id === form.convenioId)
  const set = (k: keyof FormAvulso) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // ── Validação ─────────────────────────────────────────────────────
  function validar(): string[] {
    const e: string[] = []
    if (!form.nome.trim())                          e.push('Nome do pagador é obrigatório')
    if (!form.cpfCnpj.replace(/\D/g,''))            e.push('CPF/CNPJ é obrigatório')
    if (!form.logradouro.trim())                     e.push('Logradouro é obrigatório')
    if (!form.cidade.trim())                         e.push('Cidade é obrigatória')
    if (!form.cep.replace(/\D/g,''))                e.push('CEP é obrigatório')
    if (!form.descricao.trim())                      e.push('Descrição é obrigatória')
    if (!form.dataVencimento)                        e.push('Data de vencimento é obrigatória')
    if (!form.valor || parseFloat(form.valor) <= 0) e.push('Valor deve ser maior que zero')
    if (!form.convenioId || !convenio)               e.push('Selecione um convênio bancário ativo')
    return e
  }

  // ── Gerar boleto e persistir ──────────────────────────────────────
  async function gerar() {
    const ev = validar()
    if (ev.length > 0) { setErros(ev); return }
    setErros([]); setLoading(true)

    try {
      const docNum   = form.numeroDocumento.trim() || `AVU-${Date.now().toString(36).toUpperCase()}`
      const valorNum = parseFloat(form.valor.replace(',','.'))

      const payload = {
        titulo: {
          pagador: {
            nome: form.nome.trim(),
            cpfCnpj: form.cpfCnpj.replace(/\D/g,''),
            logradouro: form.logradouro.trim(),
            numero: form.numero.trim() || 'S/N',
            complemento: form.complemento.trim(),
            bairro: form.bairro.trim() || 'A INFORMAR',
            cidade: form.cidade.trim(),
            uf: form.uf,
            cep: form.cep.replace(/\D/g,'').padStart(8,'0'),
          },
          numeroDocumento: docNum,
          descricao: form.descricao.trim(),
          especie: form.especie, aceite: form.aceite,
          dataDocumento: form.dataDocumento,
          dataVencimento: form.dataVencimento,
          valor: valorNum,
          desconto: parseFloat(form.desconto) || 0,
          abatimento: parseFloat(form.abatimento) || 0,
          percJuros: parseFloat(form.percJuros) || 0,
          percMulta: parseFloat(form.percMulta) || 0,
          dataLimiteDesconto: form.dataLimiteDesconto || undefined,
          instrucao1: form.instrucao1.slice(0,80),
          instrucao2: form.instrucao2.slice(0,80) || undefined,
          tipoProtesto: form.tipoProtesto,
          diasProtesto: parseInt(form.diasProtesto) || 0,
          competencia: form.competencia,
          alunoId: '', alunoNome: form.nome.trim(), responsavelNome: form.nome.trim(),
          convenioId: form.convenioId,
        },
        convenio: { ...convenio!, convenio: convenio!.convenio.replace(/\D/g,'').padStart(5,'0') },
        ultimoSequencial: convenio!.nossoNumeroSequencial,
      }

      const res  = await fetch('/api/boletos/emitir', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json = await res.json()

      if (!json.sucesso) { setErros(json.erros ?? [json.error ?? 'Erro desconhecido']); return }

      const d = json.dados

      // ── Monta o Titulo completo para persistir no DataContext ────────
      const novoTitulo: Titulo = {
        // obrigatórios
        id: `avulso-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        aluno: form.nome.trim(),
        responsavel: form.nome.trim(),
        descricao: form.descricao.trim(),
        valor: valorNum,
        vencimento: form.dataVencimento,
        pagamento: null,
        status: 'pendente',
        metodo: null,
        parcela: `[AVULSO] ${docNum}`,
        // bancários (retornados pela API)
        nossoNumero: d.nossoNumero,
        nossoNumeroDV: d.nossoNumeroDV,
        nossoNumeroFormatado: d.nossoNumeroFormatado,
        codigoBarras44: d.codigoBarras44,
        linhaDigitavel: d.linhaDigitavel,
        linhaDigitavelFormatada: d.linhaDigitavelFormatada,
        fatorVencimento: d.fatorVencimento,
        numeroDocumento: docNum,
        dataDocumento: form.dataDocumento,
        dataVencimento: form.dataVencimento,
        // pagador
        pagadorNome: form.nome.trim(),
        pagadorCpfCnpj: form.cpfCnpj.replace(/\D/g,''),
        pagadorLogradouro: form.logradouro.trim(),
        pagadorNumero: form.numero.trim() || 'S/N',
        pagadorComplemento: form.complemento.trim(),
        pagadorBairro: form.bairro.trim(),
        pagadorCidade: form.cidade.trim(),
        pagadorUF: form.uf,
        pagadorCEP: form.cep.replace(/\D/g,''),
        // encargos
        desconto: parseFloat(form.desconto) || 0,
        abatimento: parseFloat(form.abatimento) || 0,
        percJuros: parseFloat(form.percJuros) || 0,
        percMulta: parseFloat(form.percMulta) || 0,
        dataLimiteDesconto: form.dataLimiteDesconto || undefined,
        especie: form.especie, aceite: form.aceite,
        instrucao1: form.instrucao1,
        instrucao2: form.instrucao2 || undefined,
        tipoProtesto: form.tipoProtesto,
        diasProtesto: parseInt(form.diasProtesto) || 0,
        // status bancário → 'emitido' = disponível imediatamente para Remessa
        statusBancario: 'emitido',
        convenioId: form.convenioId,
        htmlBoleto: d.htmlBoleto,
        eventos: [{
          id: `evt-${Date.now()}`, data: new Date().toISOString(),
          tipo: 'emissao', descricao: `Boleto avulso emitido — ${docNum}`,
        }],
      }

      // ── Persiste no DataContext via callback da page.tsx ────────────
      onEmitido(novoTitulo, d.novoSequencial, form.convenioId)
      setGerado(novoTitulo)

    } catch (e: unknown) {
      setErros([(e as Error).message])
    } finally {
      setLoading(false)
    }
  }

  function imprimir() {
    if (!gerado?.htmlBoleto) return
    openBoletoHtml(gerado.htmlBoleto)
  }

  function novoAvulso() {
    setGerado(null); setErros([])
    setForm({ ...INITIAL, convenioId: form.convenioId })
  }

  // ── TELA DE SUCESSO ───────────────────────────────────────────────
  if (gerado) {
    return (
      <div>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h2 className="page-title" style={{ fontSize:18 }}>Boleto Avulso</h2>
            <p className="page-subtitle">Emitido e integrado ao sistema</p>
          </div>
        </div>

        <div style={{ maxWidth:680, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>

          {/* Banner */}
          <div className="card" style={{ padding:28, textAlign:'center', border:'1px solid rgba(52,211,153,0.25)' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(16,185,129,0.1)', border:'2px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
              <CheckCircle2 size={26} color="#10b981" />
            </div>
            <h3 style={{ fontWeight:800, fontSize:20, marginBottom:4 }}>Boleto gerado e salvo!</h3>
            <p style={{ fontSize:13, color:'hsl(var(--text-muted))' }}>
              {gerado.aluno} · {fmt(gerado.valor)} · Vence em {gerado.vencimento?.split('-').reverse().join('/')}
            </p>
          </div>

          {/* Dados bancários */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:14, paddingBottom:10, borderBottom:'1px solid hsl(var(--border-subtle))' }}>Dados Bancários</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:12 }}>
              {[
                { label:'Nosso Número', value: gerado.nossoNumeroFormatado ?? '—', mono:true },
                { label:'Banco',        value: convenio?.nomeBanco ?? '—',         mono:false },
              ].map(item => (
                <div key={item.label} style={{ padding:'10px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:4 }}>{item.label}</div>
                  <div style={{ fontWeight:700, fontSize:14, fontFamily: item.mono ? 'monospace':'inherit', color: item.mono ? '#60a5fa':undefined }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))', marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:6 }}>Linha Digitável</div>
              <div style={{ fontFamily:'monospace', fontSize:13, color:'#60a5fa', wordBreak:'break-all', fontWeight:600 }}>{gerado.linhaDigitavelFormatada}</div>
            </div>
            <div style={{ padding:'10px 14px', background:'hsl(var(--bg-elevated))', borderRadius:10, border:'1px solid hsl(var(--border-subtle))' }}>
              <div style={{ fontSize:10, fontWeight:600, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:4 }}>Código de Barras (44 dígitos)</div>
              <div style={{ fontFamily:'monospace', fontSize:11, color:'hsl(var(--text-secondary))', wordBreak:'break-all' }}>{gerado.codigoBarras44}</div>
            </div>
          </div>

          {/* Próximos passos */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:14, paddingBottom:10, borderBottom:'1px solid hsl(var(--border-subtle))' }}>Próximos Passos</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {[
                { icon:'📤', label:'Enviar Remessa', hint:'Incluir na remessa CNAB 400', aba:'remessa' },
                { icon:'📋', label:'Ver Histórico',  hint:'Consultar todos os boletos',  aba:'historico' },
                { icon:'📊', label:'Dashboard',      hint:'Painel geral de boletos',     aba:'dashboard' },
              ].map(s => (
                <button key={s.aba} onClick={() => onNavigate?.(s.aba)}
                  className="btn btn-secondary btn-sm"
                  style={{ flexDirection:'column', height:'auto', padding:'12px 10px', gap:4, alignItems:'center', textAlign:'center' }}>
                  <span style={{ fontSize:22 }}>{s.icon}</span>
                  <span style={{ fontWeight:700, fontSize:12 }}>{s.label}</span>
                  <span style={{ fontSize:10, color:'hsl(var(--text-muted))', whiteSpace:'normal', lineHeight:1.3 }}>{s.hint}</span>
                  <ArrowRight size={12} style={{ marginTop:2 }} />
                </button>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
            <button className="btn btn-primary" onClick={imprimir} style={{ gap:8 }}>
              <Printer size={15} /> Imprimir / Salvar PDF
            </button>
            <button className="btn btn-secondary" onClick={() => {
              navigator.clipboard.writeText(gerado.linhaDigitavelFormatada ?? '')
              alert('Linha digitável copiada!')
            }}>
              📋 Copiar Linha Digitável
            </button>
            <button className="btn btn-ghost" onClick={novoAvulso} style={{ gap:6 }}>
              <RotateCcw size={13} /> Novo Boleto Avulso
            </button>
          </div>

          <div style={{ fontSize:11, color:'hsl(var(--text-muted))', textAlign:'center', lineHeight:1.6 }}>
            ✅ Este boleto está salvo e integrado — disponível em{' '}
            <strong>Remessa CNAB · Retorno · Histórico · Dashboard · Sandbox</strong>
          </div>
        </div>
      </div>
    )
  }

  // ── FORMULÁRIO ────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ fontSize:18 }}>Boleto Avulso</h2>
          <p className="page-subtitle">Preencha os dados — o boleto será salvo e integrado a todo o sistema (remessa, retorno, histórico)</p>
        </div>
      </div>

      {convAtivos.length === 0 && (
        <div className="card" style={{ padding:20, marginBottom:20, border:'1px solid rgba(248,113,113,0.3)', color:'#f87171', fontSize:13 }}>
          ⚠️ Nenhum convênio bancário ativo. Configure um em &quot;Convênios&quot; antes de emitir.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20, alignItems:'start' }}>

        {/* ── Coluna esquerda ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Pagador */}
          <Section icon={<User size={15} />} title="Dados do Pagador (Sacado)">
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {(['cpf','cnpj'] as const).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, tipoDoc:t, cpfCnpj:'' }))}
                  className={`btn btn-sm ${form.tipoDoc === t ? 'btn-primary':'btn-secondary'}`}>
                  {t === 'cpf' ? <><User size={12} /> Pessoa Física (CPF)</> : <><Building2 size={12} /> Pessoa Jurídica (CNPJ)</>}
                </button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
              <Campo label="Nome / Razão Social" required>
                <input className="form-input" value={form.nome} onChange={set('nome')} placeholder={form.tipoDoc === 'cpf' ? 'João da Silva':'Empresa Ltda'} />
              </Campo>
              <Campo label={form.tipoDoc === 'cpf' ? 'CPF':'CNPJ'} required>
                <input className="form-input" value={form.cpfCnpj}
                  onChange={e => setForm(f => ({ ...f, cpfCnpj: f.tipoDoc === 'cpf' ? maskCPF(e.target.value) : maskCNPJ(e.target.value) }))}
                  placeholder={form.tipoDoc === 'cpf' ? '000.000.000-00':'00.000.000/0000-00'} />
              </Campo>
            </div>
          </Section>

          {/* Endereço */}
          <Section icon={<MapPin size={15} />} title="Endereço">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12, marginBottom:12 }}>
              <Campo label="CEP" required>
                <input className="form-input" value={form.cep} onChange={e => setForm(f => ({ ...f, cep: maskCEP(e.target.value) }))} placeholder="00000-000" maxLength={9} />
              </Campo>
              <div />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr', gap:12, marginBottom:12 }}>
              <Campo label="Logradouro" required><input className="form-input" value={form.logradouro} onChange={set('logradouro')} placeholder="Rua das Flores" /></Campo>
              <Campo label="Número"><input className="form-input" value={form.numero} onChange={set('numero')} placeholder="123" /></Campo>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 80px', gap:12 }}>
              <Campo label="Complemento"><input className="form-input" value={form.complemento} onChange={set('complemento')} placeholder="Apto 4" /></Campo>
              <Campo label="Bairro"><input className="form-input" value={form.bairro} onChange={set('bairro')} placeholder="Centro" /></Campo>
              <Campo label="Cidade" required><input className="form-input" value={form.cidade} onChange={set('cidade')} placeholder="São Paulo" /></Campo>
              <Campo label="UF">
                <select className="form-input" value={form.uf} onChange={set('uf')}>{UFS.map(u => <option key={u}>{u}</option>)}</select>
              </Campo>
            </div>
          </Section>

          {/* Título */}
          <Section icon={<FileText size={15} />} title="Dados do Título">
            <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr', gap:12, marginBottom:12 }}>
              <Campo label="Descrição / Referência" required>
                <input className="form-input" value={form.descricao} onChange={set('descricao')} placeholder="Ex: Mensalidade Abril/2026 — João Silva" />
              </Campo>
              <Campo label="Nº Documento">
                <input className="form-input" value={form.numeroDocumento} onChange={set('numeroDocumento')} placeholder="Auto" />
              </Campo>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <Campo label="Competência"><input type="month" className="form-input" value={form.competencia} onChange={set('competencia')} /></Campo>
              <Campo label="Data Emissão"><input type="date" className="form-input" value={form.dataDocumento} onChange={set('dataDocumento')} /></Campo>
              <Campo label="Espécie">
                <select className="form-input" value={form.especie} onChange={set('especie')}>
                  <option value="DS">DS — Diversos</option><option value="REC">REC — Recibo</option>
                  <option value="DM">DM — Duplicata</option><option value="NF">NF — Nota Fiscal</option>
                </select>
              </Campo>
              <Campo label="Aceite">
                <select className="form-input" value={form.aceite} onChange={set('aceite')}>
                  <option value="N">N — Não Aceito</option><option value="A">A — Aceito</option>
                </select>
              </Campo>
            </div>
          </Section>

          {/* Encargos */}
          <Section icon={<DollarSign size={15} />} title="Valores e Encargos">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:12 }}>
              <Campo label="Valor (R$)" required>
                <input type="number" step="0.01" min="0" className="form-input" value={form.valor} onChange={set('valor')} placeholder="0,00" style={{ fontWeight:700 }} />
              </Campo>
              <Campo label="Juros %/dia" hint="Ex: 0.033">
                <input type="number" step="0.001" min="0" className="form-input" value={form.percJuros} onChange={set('percJuros')} />
              </Campo>
              <Campo label="Multa %">
                <input type="number" step="0.01" min="0" className="form-input" value={form.percMulta} onChange={set('percMulta')} />
              </Campo>
              <Campo label="Desconto R$">
                <input type="number" step="0.01" min="0" className="form-input" value={form.desconto} onChange={set('desconto')} />
              </Campo>
              <Campo label="Abatimento R$">
                <input type="number" step="0.01" min="0" className="form-input" value={form.abatimento} onChange={set('abatimento')} />
              </Campo>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <Campo label="Limite p/ Desconto">
                <input type="date" className="form-input" value={form.dataLimiteDesconto} onChange={set('dataLimiteDesconto')} />
              </Campo>
              <Campo label="Tipo Protesto">
                <select className="form-input" value={form.tipoProtesto} onChange={set('tipoProtesto')}>
                  <option value="0">Sem protesto</option><option value="1">Dias corridos</option>
                  <option value="2">Dias úteis</option><option value="3">Devolver</option>
                </select>
              </Campo>
              {form.tipoProtesto !== '0' && (
                <Campo label="Dias p/ protesto">
                  <input type="number" min="1" max="99" className="form-input" value={form.diasProtesto} onChange={set('diasProtesto')} />
                </Campo>
              )}
            </div>
          </Section>

          {/* Instruções */}
          <Section icon={<Info size={15} />} title="Instruções de Cobrança">
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <Campo label="Instrução 1 (máx 80 chars)">
                <input className="form-input" value={form.instrucao1} maxLength={80}
                  onChange={e => setForm(f => ({ ...f, instrucao1: e.target.value.slice(0,80) }))} />
                <div style={{ fontSize:10, color:'hsl(var(--text-muted))', marginTop:2 }}>{form.instrucao1.length}/80</div>
              </Campo>
              <Campo label="Instrução 2 (opcional)">
                <input className="form-input" value={form.instrucao2} maxLength={80}
                  onChange={e => setForm(f => ({ ...f, instrucao2: e.target.value.slice(0,80) }))} />
              </Campo>
            </div>
          </Section>
        </div>

        {/* ── Sidebar direita ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, position:'sticky', top:0 }}>

          {/* Convênio */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontWeight:700, fontSize:12, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>🏦 Convênio Bancário</div>
            <select className="form-input" value={form.convenioId} onChange={set('convenioId')}>
              {convAtivos.length === 0
                ? <option disabled>Nenhum ativo</option>
                : convAtivos.map(c => <option key={c.id} value={c.id}>{c.nomeBanco} · Cart. {c.carteira}</option>)}
            </select>
            {convenio && (
              <div style={{ marginTop:10, fontSize:11, color:'hsl(var(--text-muted))', display:'flex', flexDirection:'column', gap:3 }}>
                <div>Ag: <strong>{convenio.agencia}</strong> · Conta: <strong>{convenio.conta}-{convenio.digitoConta}</strong></div>
                <div>Cedente: <strong>{convenio.cedente}</strong></div>
                <div>Próximo Seq: <strong>#{convenio.nossoNumeroSequencial + 1}</strong></div>
                {convenio.ambiente === 'homologacao' && <span className="badge badge-warning" style={{ alignSelf:'flex-start', marginTop:4 }}>⚠️ Homologação</span>}
              </div>
            )}
          </div>

          {/* Vencimento */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontWeight:700, fontSize:12, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>
              <Calendar size={12} style={{ display:'inline', marginRight:6 }} />Vencimento
            </div>
            <input type="date" className="form-input" value={form.dataVencimento} onChange={set('dataVencimento')}
              style={{ fontWeight:700, fontSize:15, textAlign:'center' }} />
          </div>

          {/* Resumo live */}
          <div className="card" style={{ padding:16 }}>
            <div style={{ fontWeight:700, fontSize:12, color:'hsl(var(--text-muted))', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Resumo</div>
            {[
              { label:'Pagador',    value: form.nome || '—' },
              { label:'Documento',  value: form.tipoDoc.toUpperCase()+': '+(form.cpfCnpj || '—') },
              { label:'Descrição',  value: form.descricao || '—' },
              { label:'Vencimento', value: form.dataVencimento ? form.dataVencimento.split('-').reverse().join('/') : '—' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', flexDirection:'column', paddingBottom:6, marginBottom:6, borderBottom:'1px solid hsl(var(--border-subtle))' }}>
                <span style={{ fontSize:10, color:'hsl(var(--text-muted))', textTransform:'uppercase' }}>{r.label}</span>
                <span style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ textAlign:'center', marginTop:6 }}>
              <div style={{ fontSize:10, color:'hsl(var(--text-muted))', textTransform:'uppercase', marginBottom:2 }}>Valor</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#3b82f6', fontFamily:'Outfit,sans-serif' }}>
                {form.valor ? fmt(parseFloat(form.valor.replace(',','.')) || 0) : 'R$ 0,00'}
              </div>
            </div>
          </div>

          {/* Erros */}
          {erros.length > 0 && (
            <div className="card" style={{ padding:14, border:'1px solid rgba(248,113,113,0.3)' }}>
              <div style={{ fontWeight:700, fontSize:12, color:'#f87171', marginBottom:8 }}>⚠️ Corrija os campos:</div>
              <ul style={{ margin:0, paddingLeft:16 }}>
                {erros.map((e,i) => <li key={i} style={{ fontSize:12, color:'#f87171', marginBottom:3 }}>{e}</li>)}
              </ul>
            </div>
          )}

          <button className="btn btn-primary" disabled={loading || convAtivos.length === 0} onClick={gerar}
            style={{ padding:'14px 20px', fontSize:14, fontWeight:700, gap:8 }}>
            {loading
              ? <><span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .8s linear infinite' }} />Gerando...</>
              : <><Printer size={15} /> Gerar e Salvar Boleto</>}
          </button>
          <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>

          <div style={{ fontSize:10, color:'hsl(var(--text-muted))', textAlign:'center', lineHeight:1.6 }}>
            Boleto salvo automaticamente no sistema.<br />
            <strong>Remessa · Retorno · Histórico · Dashboard</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
