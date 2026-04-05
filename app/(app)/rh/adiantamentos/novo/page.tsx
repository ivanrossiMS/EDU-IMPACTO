'use client'

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
  const { funcionarios, adiantamentos, setAdiantamentos, logSystemAction } = useData()
  
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
          <Link href="/rh/adiantamentos" className="btn btn-ghost btn-icon" style={{ background: 'hsl(var(--bg-elevated))' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <nav className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
              <Link href="/rh/adiantamentos" className="hover:text-blue-600 transition-colors">Adiantamentos</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium tracking-tight">Novo Adiantamento</span>
            </nav>
            <h1 className="page-title" style={{ fontSize: 24 }}>Novo Adiantamento</h1>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
        
        {/* COLUNA ESQUERDA - FORM (Span 2) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* BLOCO 1: FUNCIONÁRIO */}
          <div className="card shadow-sm relative overflow-hidden" style={{ padding: 24, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#047857', fontWeight: 600 }}>
              <UserSquare2 size={18} />
              <h3>1. Beneficiário</h3>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1">Selecione o Funcionário / Cargos</label>
              <select 
                value={funcId} 
                onChange={e => setFuncId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-700 outline-none"
              >
                <option value="" disabled>-- Clique para selecionar --</option>
                {ativos.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.cargo} ({f.unidade})</option>
                ))}
              </select>
            </div>
            
            {func && (
              <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4">
                 <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-lg uppercase">
                    {func.nome.substring(0,2)}
                 </div>
                 <div className="flex-1">
                    <p className="font-bold text-slate-800 text-sm leading-tight">{func.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{func.departamento} • Contratado em {new Date(func.admissao).toLocaleDateString()}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-semibold">Salário Base</p>
                    <p className="font-bold text-emerald-700">{formatMoney(func.salario)}</p>
                 </div>
              </div>
            )}
          </div>

          {/* BLOCO 2: DADOS DO ADIANTAMENTO */}
          <div className="card shadow-sm" style={{ padding: 24, borderRadius: 16, transition: 'opacity 300ms', opacity: !isFuncSelected ? 0.5 : 1, pointerEvents: !isFuncSelected ? 'none' : 'auto' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#1d4ed8', fontWeight: 600 }}>
              <Banknote size={18} />
              <h3>2. Condições Financeiras</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total Requerido (R$)</label>
                <input 
                  type="number" step="0.01" min="0" placeholder="ex: 1500.00"
                  value={valorTotalStr} onChange={e => setValorTotalStr(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Parcelas</label>
                <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <button onClick={() => setQtdParcelas(Math.max(1, qtdParcelas-1))} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors">-</button>
                  <input type="number" min="1" max="24" value={qtdParcelas} readOnly className="w-full text-center bg-transparent outline-none font-bold text-slate-700" />
                  <button onClick={() => setQtdParcelas(Math.min(24, qtdParcelas+1))} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors">+</button>
                </div>
              </div>
            </div>

            {isValorValid && func && Math.round((valorTotal / func.salario)*100) > 30 && (
              <div className="mt-3 p-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs flex gap-2">
                 <AlertCircle size={16} className="shrink-0 mt-0.5" />
                 <p>O valor solicitado compromete mais de 30% do salário base do funcionário ({Math.round((valorTotal / func.salario)*100)}%). Sujeito à aprovação da diretoria.</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data p/ Desconto/Pagto da 1ª</label>
                <input 
                  type="date"
                  value={primeiraData} onChange={e => setPrimeiraData(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estratégia de Quitação</label>
                <select 
                  value={formaQuitacao} onChange={e => setFormaQuitacao(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                >
                  <option value="desconto_folha">Desconto em Folha (Automático)</option>
                  <option value="manual">Pagamento Manual (Caixa/PIX)</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Lançamento</label>
                <select 
                  value={tipo} onChange={e => setTipo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                >
                  <option value="salarial">Adiantamento de Salário</option>
                  <option value="extraordinario">Ajuda Extraordinária</option>
                  <option value="emprestimo">Empréstimo Familiar</option>
                  <option value="outro">Outro (Especificar Motivo)</option>
                </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Motivo (Opcional p/ aprovação)</label>
                 <input 
                  type="text" placeholder="Ex: Reforma urgência, Viagem..."
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-slate-700"
                />
              </div>
            </div>

          </div>

        </div>

        {/* COLUNA DIREITA - PARCELAMENTO & SALVAR (Span 1) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, transition: 'opacity 300ms', opacity: !isFuncSelected || !isValorValid ? 0.5 : 1, pointerEvents: !isFuncSelected || !isValorValid ? 'none' : 'auto' }}>
          
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', color: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', position: 'relative', overflow: 'hidden' }}>
             
             {/* Decor element */}
             <div style={{ position: 'absolute', top: 0, right: 0, width: 128, height: 128, background: '#3b82f6', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.2, margin: '-40px' }}></div>

             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#93c5fd', fontWeight: 600, position: 'relative', zIndex: 10 }}>
              <Calculator size={18} />
              <h3>Simulação / Dízimas</h3>
            </div>
            
            {previewParcelas.length === 0 ? (
               <p className="text-slate-400 text-sm italic">Preencha o valor e parcelas para gerar a pré-visualização contábil.</p>
            ) : (
              <div className="relative z-10">
                 <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {previewParcelas.map((p, index) => (
                      <div key={p.numero} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                         <div className="flex items-center gap-3">
                           <span className="w-6 h-6 rounded bg-slate-700 text-xs font-bold flex items-center justify-center text-slate-300">{p.numero}</span>
                           <span className="text-sm font-medium text-slate-200">
                              {new Date(p.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                           </span>
                         </div>
                         <span className={`font-bold text-sm ${index === previewParcelas.length - 1 && hasResidual ? 'text-amber-400' : 'text-blue-300'}`}>
                           {formatMoney(p.valor)}
                         </span>
                      </div>
                    ))}
                 </div>
                 
                 <div className="mt-4 pt-4 border-t border-slate-700">
                   <div className="flex justify-between items-end">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Total Simulado</span>
                      <span className="text-xl font-bold bg-gradient-to-r from-blue-300 to-blue-100 bg-clip-text text-transparent">
                        {formatMoney(previewParcelas.reduce((acc, curr) => acc + curr.valor, 0))}
                      </span>
                   </div>
                 </div>

                 {hasResidual && (
                   <div className="mt-4 flex gap-2 items-start text-xs text-amber-200/80 bg-amber-900/20 p-2 rounded-lg border border-amber-900/50">
                     <Info size={14} className="shrink-0 mt-0.5" />
                     <p>A última parcela absorveu a dízima / diferença para fechar os centavos exatos contábeis.</p>
                   </div>
                 )}
              </div>
            )}
          </div>

          <button 
            onClick={handleSave}
            disabled={!isFuncSelected || !isValorValid || !isQtdValid}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl flex flex-row items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <Save size={18} className="group-hover:scale-110 transition-transform" />
            Salvar Adiantamento
          </button>
        </div>

      </div>
    </div>
  )
}
