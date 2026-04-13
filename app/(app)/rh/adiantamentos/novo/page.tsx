'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useData, newId, Funcionario } from '@/lib/dataContext'
import { ArrowLeft, Save, Info, Calculator, CalendarDays, UserSquare2, Banknote, AlertCircle } from 'lucide-react'

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime())
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export default function NovoAdiantamento() {
  const router = useRouter()
  const { adiantamentos = [], setAdiantamentos, logSystemAction } = useData();
  const [funcionarios, setFuncionarios] = useSupabaseArray<any>('rh/funcionarios');
  
  const ativos = funcionarios.filter(f => f.status === 'ativo')

  const [funcId, setFuncId] = useState('')
  const [valorTotalStr, setValorTotalStr] = useState('')
  const [qtdParcelas, setQtdParcelas] = useState(1)
  const [primeiraData, setPrimeiraData] = useState(() => {
    // default to +1 week
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [tipo, setTipo] = useState('salarial')
  const [motivo, setMotivo] = useState('')
  const [formaQuitacao, setFormaQuitacao] = useState('desconto_folha')

  // Validation
  const valorTotal = parseFloat(valorTotalStr.replace(/\./g, '').replace(',', '.')) || 0
  const isFuncSelected = funcId !== ''
  const isValorValid = valorTotal > 0
  const isQtdValid = qtdParcelas > 0 && qtdParcelas <= 24
  const isDataValid = primeiraData !== ''

  const func = ativos.find(f => f.id === funcId)

  // Math calculation of parcels
  const previewParcelas = useMemo(() => {
    if (!isValorValid || !isQtdValid || !isDataValid) return []
    
    // Contábil math
    const baseValue = Math.floor((valorTotal / qtdParcelas) * 100) / 100
    // O JS aproxima dízimas as vezes, entao arredondamos para duas casas
    let totalComputed = Math.round((baseValue * qtdParcelas) * 100) / 100
    const remainder = Math.round((valorTotal - totalComputed) * 100) / 100

    const parcelas = []
    let currentDate = new Date(primeiraData + 'T12:00:00Z') // Fix time to prevent timezone shift issues
    
    for (let i = 1; i <= qtdParcelas; i++) {
        let val = baseValue
        if (i === qtdParcelas) {
           val = Math.round((baseValue + remainder) * 100) / 100
        }
        
        parcelas.push({
            numero: i,
            valor: val,
            vencimento: currentDate.toISOString().split('T')[0],
            status: 'programada',
            dataPagamento: null,
            formaQuitacao,
        })
        
        // Add 1 month exactly maintaining day (careful with 31sts).
        // For simplicity, just add 1 month precisely in Date obj logic.
        const nextTimeDate = new Date(currentDate.getTime())
        nextTimeDate.setMonth(nextTimeDate.getMonth() + 1)
        currentDate = nextTimeDate
    }
    return parcelas
  }, [valorTotal, qtdParcelas, primeiraData, formaQuitacao, isValorValid, isQtdValid, isDataValid])

  const hasResidual = useMemo(() => {
    if (previewParcelas.length < 2) return false
    const v1 = previewParcelas[0].valor
    const vLast = previewParcelas[previewParcelas.length - 1].valor
    return v1 !== vLast
  }, [previewParcelas])

  const handleSave = () => {
    if (!func || !isValorValid || !isQtdValid || !isDataValid) return
    
    const ad: any = {
      id: newId('AD'),
      funcionarioId: func.id,
      funcionarioNome: func.nome,
      matricula: Math.floor(1000 + Math.random() * 9000).toString(), // Mock matricula if absent
      cargo: func.cargo,
      setor: func.departamento,
      unidade: func.unidade,
      salarioAtual: func.salario,
      dataSolicitacao: new Date().toISOString().split('T')[0],
      dataLiberacao: null,
      competenciaRef: primeiraData.substring(0,7),
      valorTotal: valorTotal,
      quantidadeParcelas: qtdParcelas,
      primeiraData: primeiraData,
      tipoLancamento: tipo,
      motivo,
      formaQuitacao,
      status: 'pendente',
      responsavelLancamento: 'Admin Logado', // Mock session
      aprovador: undefined,
      dataAprovacao: undefined,
      aprovacaoObs: undefined,
      logs: [{
        id: newId('L'),
        dataHora: new Date().toISOString(),
        acao: 'Lançado no sistema',
        usuario: 'Admin Logado'
      }],
      parcelas: previewParcelas.map(p => ({
        id: newId('P'),
        numero: p.numero,
        valor: p.valor,
        vencimento: p.vencimento,
        status: 'pendente',
        dataPagamento: null,
        formaQuitacao: p.formaQuitacao,
        responsavel: 'Admin Logado'
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setAdiantamentos([...adiantamentos, ad])
    logSystemAction('RH (Adiantamentos)', 'Concessão', `Novo adiantamento de R$ ${valorTotal} para ${func?.nome}`, { nomeRelacionado: func?.nome, detalhesDepois: ad })
    router.push('/rh/adiantamentos')
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%', paddingBottom: 60 }}>
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: 24, alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/rh/adiantamentos" className="btn btn-ghost btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="page-title">Novo Adiantamento</h1>
            <p className="page-subtitle">Preencha os dados abaixo para conceder um adiantamento</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
        
        {/* COLUNA ESQUERDA - FORM (Span 2) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* BLOCO 1: FUNCIONÁRIO */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'hsl(var(--primary))', fontWeight: 600 }}>
              <UserSquare2 size={18} />
              <h3>1. Beneficiário</h3>
            </div>
            <div>
              <label className="form-label">Selecione o Funcionário / Cargos</label>
              <select 
                value={funcId} 
                onChange={e => setFuncId(e.target.value)}
                className="form-input"
              >
                <option value="" disabled>-- Clique para selecionar --</option>
                {ativos.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.cargo} ({f.unidade})</option>
                ))}
              </select>
            </div>
            
            {func && (
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                 <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textTransform: 'uppercase' }}>
                    {func.nome.substring(0,2)}
                 </div>
                 <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{func.nome}</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{func.departamento} • Contratado em {new Date(func.admissao).toLocaleDateString()}</div>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 600 }}>Salário Base</div>
                    <div style={{ fontWeight: 800, color: '#047857' }}>{formatMoney(func.salario)}</div>
                 </div>
              </div>
            )}
          </div>

          {/* BLOCO 2: DADOS DO ADIANTAMENTO */}
          <div className="card" style={{ padding: 24, transition: 'opacity 300ms', opacity: !isFuncSelected ? 0.5 : 1, pointerEvents: !isFuncSelected ? 'none' : 'auto' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'hsl(var(--primary))', fontWeight: 600 }}>
              <Banknote size={18} />
              <h3>2. Condições Financeiras</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                <label className="form-label">Valor Total Requerido (R$)</label>
                <input 
                  type="number" step="0.01" min="0" placeholder="ex: 1500.00"
                  value={valorTotalStr} onChange={e => setValorTotalStr(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Qtd. Parcelas</label>
                <div style={{ display: 'flex', background: 'hsl(var(--bg-base))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setQtdParcelas(Math.max(1, qtdParcelas-1))} style={{ padding: '8px 16px', background: 'hsl(var(--bg-elevated))', borderRight: '1px solid hsl(var(--border-subtle))', fontWeight: 800, cursor: 'pointer' }}>-</button>
                  <input type="number" min="1" max="24" value={qtdParcelas} readOnly style={{ width: '100%', textAlign: 'center', background: 'transparent', border: 'none', fontWeight: 700, outline: 'none' }} />
                  <button onClick={() => setQtdParcelas(Math.min(24, qtdParcelas+1))} style={{ padding: '8px 16px', background: 'hsl(var(--bg-elevated))', borderLeft: '1px solid hsl(var(--border-subtle))', fontWeight: 800, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>

            {isValorValid && func && Math.round((valorTotal / func.salario)*100) > 30 && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 12, display: 'flex', gap: 8 }}>
                 <AlertCircle size={16} />
                 <p>O valor solicitado compromete mais de 30% do salário base do funcionário ({Math.round((valorTotal / func.salario)*100)}%). Sujeito à aprovação da diretoria.</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label className="form-label">Data p/ Desconto/Pagto da 1ª</label>
                <input 
                  type="date"
                  value={primeiraData} onChange={e => setPrimeiraData(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Estratégia de Quitação</label>
                <select 
                  value={formaQuitacao} onChange={e => setFormaQuitacao(e.target.value)}
                  className="form-input"
                >
                  <option value="desconto_folha">Desconto em Folha (Automático)</option>
                  <option value="manual">Pagamento Manual (Caixa/PIX)</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label className="form-label">Tipo de Lançamento</label>
                <select 
                  value={tipo} onChange={e => setTipo(e.target.value)}
                  className="form-input"
                >
                  <option value="salarial">Adiantamento de Salário</option>
                  <option value="extraordinario">Ajuda Extraordinária</option>
                  <option value="emprestimo">Empréstimo Familiar</option>
                  <option value="outro">Outro (Especificar Motivo)</option>
                </select>
              </div>
              <div>
                 <label className="form-label">Motivo (Opcional)</label>
                 <input 
                  type="text" placeholder="Ex: Reforma urgência, Viagem..."
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

          </div>

        </div>

        {/* COLUNA DIREITA - PARCELAMENTO & SALVAR (Span 1) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, transition: 'opacity 300ms', opacity: !isFuncSelected || !isValorValid ? 0.3 : 1, pointerEvents: !isFuncSelected || !isValorValid ? 'none' : 'auto' }}>
          
          <div style={{ background: 'var(--gradient-dark)', border: '1px solid hsl(var(--border-subtle))', color: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#93c5fd', fontWeight: 600, position: 'relative', zIndex: 10 }}>
              <Calculator size={18} />
              <h3>Simulação / Dízimas</h3>
            </div>
            
            {previewParcelas.length === 0 ? (
               <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontStyle: 'italic' }}>Preencha o valor e parcelas para gerar a pré-visualização contábil.</p>
            ) : (
              <div style={{ position: 'relative', zIndex: 10 }}>
                 <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {previewParcelas.map((p, index) => (
                      <div key={p.numero} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                         <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                           <span style={{ width: 24, height: 24, borderRadius: 4, background: 'rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.numero}</span>
                           <span style={{ fontSize: 13, fontWeight: 500 }}>
                              {new Date(p.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                           </span>
                         </div>
                         <span style={{ fontWeight: 800, fontSize: 13, color: index === previewParcelas.length - 1 && hasResidual ? '#fbbf24' : '#93c5fd' }}>
                           {formatMoney(p.valor)}
                         </span>
                      </div>
                    ))}
                 </div>
                 
                 <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>Total Simulado</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                        {formatMoney(previewParcelas.reduce((acc, curr) => acc + curr.valor, 0))}
                      </span>
                   </div>
                 </div>

                 {hasResidual && (
                   <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: '#fde68a', background: 'rgba(245,158,11,0.15)', padding: 12, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
                     <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                     <p>A última parcela absorveu a dízima / diferença para fechar os centavos exatos contábeis.</p>
                   </div>
                 )}
              </div>
            )}
          </div>

          <button 
            onClick={handleSave}
            disabled={!isFuncSelected || !isValorValid || !isQtdValid}
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: 15, justifyContent: 'center' }}
          >
            <Save size={18} />
            Salvar Adiantamento
          </button>
        </div>

      </div>
    </div>
  )
}
