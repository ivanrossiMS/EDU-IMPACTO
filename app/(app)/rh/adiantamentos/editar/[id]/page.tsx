'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Funcionario } from '@/lib/dataContext'
import { ArrowLeft, Save, Info, Calculator, CalendarDays, UserSquare2, Banknote, AlertCircle, ChevronRight, Sparkles, TrendingDown, Percent } from 'lucide-react'

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function EditarAdiantamento() {
  const router = useRouter()
  const params = useParams()
  const idStr = params.id as string
  const [adiantamentos = [], setAdiantamentos] = useSupabaseArray<any>('rh/adiantamentos', [])
  const [funcionarios = [], setFuncionarios] = useSupabaseArray<any>('rh/funcionarios');
  
  const item = adiantamentos.find(a => a.id === idStr)
  const ativos = (funcionarios || []).filter(f => f.status === 'ativo')

  const [funcId, setFuncId] = useState(item?.funcionarioId || '')
  const [valorTotalStr, setValorTotalStr] = useState((item?.valorTotal || '').toString())
  const [qtdParcelas, setQtdParcelas] = useState(item?.quantidadeParcelas || 1)
  const [primeiraData, setPrimeiraData] = useState(() => {
    if (item?.primeiraData) return item.primeiraData
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [tipo, setTipo] = useState<any>(item?.tipoLancamento || 'salarial')
  const [motivo, setMotivo] = useState(item?.motivo || '')
  const [formaQuitacao, setFormaQuitacao] = useState<any>(item?.formaQuitacao || 'desconto_folha')

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
    
    const baseValue = Math.floor((valorTotal / qtdParcelas) * 100) / 100
    let totalComputed = Math.round((baseValue * qtdParcelas) * 100) / 100
    const remainder = Math.round((valorTotal - totalComputed) * 100) / 100

    const parcelas = []
    let currentDate = new Date(primeiraData + 'T12:00:00Z')
    
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

  const margemComprometida = useMemo(() => {
    if (!func || !valorTotal) return 0
    return Math.round((valorTotal / func.salario) * 100)
  }, [func, valorTotal])

  const handleSave = () => {
    if (!func || !isValorValid || !isQtdValid || !isDataValid || !item) return
    
    const ad: any = {
      ...item,
      funcionarioId: func.id,
      funcionarioNome: func.nome,
      matricula: item.matricula || Math.floor(1000 + Math.random() * 9000).toString(),
      cargo: func.cargo,
      setor: func.departamento,
      unidade: func.unidade,
      salarioAtual: func.salario,
      competenciaRef: primeiraData.substring(0,7),
      valorTotal: valorTotal,
      quantidadeParcelas: qtdParcelas,
      primeiraData: primeiraData,
      tipoLancamento: tipo,
      motivo,
      formaQuitacao,
      logs: [
         ...item.logs,
         {
          id: Date.now().toString(),
          dataHora: new Date().toISOString(),
          acao: 'Editado / Recalculado (Diretoria Financeira)',
          usuario: 'Diretor Financeiro'
         }
      ],
      parcelas: previewParcelas.map((p, idx) => {
         return {
          id: item.parcelas[idx]?.id || `P-${Date.now()}-${idx}`,
          numero: p.numero,
          valor: p.valor,
          vencimento: p.vencimento,
          status: 'pendente',
          dataPagamento: null,
          formaQuitacao: p.formaQuitacao,
          responsavel: 'Diretor Financeiro'
         }
      }),
      updatedAt: new Date().toISOString(),
    }

    setAdiantamentos(adiantamentos.map(a => a.id === idStr ? ad : a))
    router.push('/rh/adiantamentos')
  }

  if (!item) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontFamily: 'Inter, sans-serif' }}>Adiantamento não encontrado.</div>
  }

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    padding: '24px',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: '#0f172a' }}>
      
      {/* HEADER */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/rh/adiantamentos" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link href="/rh/adiantamentos" style={{ color: '#64748b', textDecoration: 'none' }}>Gestão de Adiantamentos</Link>
              <span>/</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{idStr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Análise e Edição de Adiantamento</h1>
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Status do Contrato</p>
          <p style={{ fontWeight: 700, margin: 0, fontSize: '14px', color: '#059669' }}>ATIVO / EM ANÁLISE</p>
        </div>
      </div>

      {/* RESUMO RÁPIDO */}
      <div style={{ ...cardStyle, padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '24px', background: '#f8fafc' }}>
        <div><span style={{ color: '#64748b', fontSize: '13px' }}>Beneficiário:</span> <span style={{ fontWeight: 700, fontSize: '13px' }}>{func?.nome || '--'}</span></div>
        <div><span style={{ color: '#64748b', fontSize: '13px' }}>Valor Atual:</span> <span style={{ fontWeight: 700, fontSize: '13px' }}>{formatMoney(valorTotal)}</span></div>
        <div><span style={{ color: '#64748b', fontSize: '13px' }}>Parcelas:</span> <span style={{ fontWeight: 700, fontSize: '13px' }}>{qtdParcelas}x</span></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* BLOCO 1: BENEFICIÁRIO */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <UserSquare2 size={16} />
              <span>1. Análise do Beneficiário</span>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Funcionário Vinculado</label>
              <select 
                value={funcId} 
                onChange={e => setFuncId(e.target.value)}
                disabled={true}
                style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }}
              >
                <option value="" disabled>-- Selecione o funcionário --</option>
                {ativos.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.cargo} ({f.unidade})</option>
                ))}
              </select>
            </div>
            
            {func && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Salário Base</p>
                  <p style={{ fontWeight: 700, margin: '4px 0 0', fontSize: '15px' }}>{formatMoney(func.salario)}</p>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Margem (30%)</p>
                  <p style={{ fontWeight: 700, margin: '4px 0 0', fontSize: '15px' }}>{formatMoney(func.salario * 0.3)}</p>
                </div>
                <div style={{ background: margemComprometida > 30 ? '#fffbeb' : '#f8fafc', padding: '12px', borderRadius: '8px', border: margemComprometida > 30 ? '1px solid #fde68a' : '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Comprometimento</p>
                  <p style={{ fontWeight: 700, margin: '4px 0 0', fontSize: '15px', color: margemComprometida > 30 ? '#b45309' : '#0f172a' }}>{margemComprometida}%</p>
                </div>
              </div>
            )}
          </div>

          {/* BLOCO 2: CONDIÇÕES */}
          <div style={{ ...cardStyle, opacity: !isFuncSelected ? 0.5 : 1, pointerEvents: !isFuncSelected ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <Banknote size={16} />
              <span>2. Condições do Adiantamento</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Valor Total</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '14px', color: '#64748b', fontWeight: 700 }}>R$</span>
                  <input 
                    type="number" step="0.01" min="0"
                    value={valorTotalStr} onChange={e => setValorTotalStr(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: '36px', fontWeight: 700 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Parcelas</label>
                <div style={{ display: 'flex', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <button onClick={() => setQtdParcelas(Math.max(1, qtdParcelas-1))} style={{ width: '40px', height: '40px', background: '#f1f5f9', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 700 }}>-</button>
                  <input type="number" value={qtdParcelas} readOnly style={{ width: '100%', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 700, fontSize: '14px' }} />
                  <button onClick={() => setQtdParcelas(Math.min(24, qtdParcelas+1))} style={{ width: '40px', height: '40px', background: '#f1f5f9', border: 'none', borderLeft: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Data de Início</label>
                <input 
                  type="date"
                  value={primeiraData} onChange={e => setPrimeiraData(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Estratégia</label>
                <select value={formaQuitacao} onChange={e => setFormaQuitacao(e.target.value)} style={inputStyle}>
                  <option value="desconto_folha">Desconto em Folha</option>
                  <option value="manual">Pagamento Manual</option>
                  <option value="misto">Misto</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Classificação</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
                  <option value="salarial">Adiantamento de Salário</option>
                  <option value="extraordinario">Ajuda Extraordinária</option>
                  <option value="emprestimo">Empréstimo Familiar</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Justificativa</label>
                <input 
                  type="text" placeholder="Opcional"
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', opacity: !isFuncSelected || !isValorValid ? 0.5 : 1, pointerEvents: !isFuncSelected || !isValorValid ? 'none' : 'auto' }}>
          
          {/* PROJEÇÃO */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <Calculator size={16} />
              <span>Projeção</span>
            </div>
            
            {previewParcelas.length === 0 ? (
               <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>Defina o valor e prazo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                    {previewParcelas.map((p, index) => (
                      <div key={p.numero} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <span style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#e2e8f0', color: '#475569', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>{p.numero}</span>
                           <span style={{ fontSize: '12px', fontWeight: 500 }}>
                              {new Date(p.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                           </span>
                         </div>
                         <span style={{ fontWeight: 700, fontSize: '13px', color: index === previewParcelas.length - 1 && hasResidual ? '#b45309' : '#0f172a' }}>
                           {formatMoney(p.valor)}
                         </span>
                      </div>
                    ))}
                 </div>
                 
                 <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total</span>
                    <span style={{ fontSize: '18px', fontWeight: 800 }}>
                      {formatMoney(previewParcelas.reduce((acc, curr) => acc + curr.valor, 0))}
                    </span>
                 </div>
              </div>
            )}
          </div>

          {/* IMPACTO */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 700, fontSize: '14px', color: '#475569', textTransform: 'uppercase' }}>
              <Percent size={16} />
              <span>Impacto em Folha</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Desconto Mensal:</span>
                <span style={{ fontWeight: 700 }}>{previewParcelas.length > 0 ? formatMoney(previewParcelas[0].valor) : '--'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Margem Utilizada:</span>
                <span style={{ fontWeight: 700, color: margemComprometida > 30 ? '#b45309' : '#059669' }}>
                  {func && previewParcelas.length > 0 ? `${Math.round((previewParcelas[0].valor / func.salario) * 100)}%` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* BOTÃO */}
          <button 
            onClick={handleSave}
            disabled={!isFuncSelected || !isValorValid || !isQtdValid}
            style={{ height: '44px', width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!isFuncSelected || !isValorValid || !isQtdValid) ? 0.5 : 1, cursor: (!isFuncSelected || !isValorValid || !isQtdValid) ? 'not-allowed' : 'pointer' }}
          >
            <Save size={18} />
            Efetivar Alterações
          </button>
        </div>

      </div>
    </div>
  )
}
