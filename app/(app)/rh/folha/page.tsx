'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

import { useState, useMemo } from 'react'

import { formatCurrency } from '@/lib/utils'
import {
  Banknote, Search, Filter, Download, ChevronDown, CheckCircle, Clock,
  AlertTriangle, TrendingUp, Users2, DollarSign, Calendar, X, Check, FileText, PieChart, Info
} from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Tabelas Oficiais 2024
const IR_TABLE = [
  { ate: 2259.20, aliquota: 0, parcela: 0 },
  { ate: 2826.65, aliquota: 0.075, parcela: 169.44 },
  { ate: 3751.05, aliquota: 0.15, parcela: 381.44 },
  { ate: 4664.68, aliquota: 0.225, parcela: 662.77 },
  { ate: Infinity, aliquota: 0.275, parcela: 896.00 },
]
const INSS_EMP_TABLE = [
  { ate: 1412, aliquota: 0.075 },
  { ate: 2666.68, aliquota: 0.09 },
  { ate: 4000.03, aliquota: 0.12 },
  { ate: 7786.02, aliquota: 0.14 },
]

function calcINSS(salario: number) {
  let inss = 0; let base = 0
  for (const f of INSS_EMP_TABLE) {
    const teto = Math.min(salario, f.ate) - base
    if (teto <= 0) break
    inss += teto * f.aliquota; base = Math.min(salario, f.ate)
  }
  return +inss.toFixed(2)
}

function calcIR(baseCalculo: number) {
  for (const f of IR_TABLE) {
    if (baseCalculo <= f.ate) {
      return +(baseCalculo * f.aliquota - f.parcela).toFixed(2)
    }
  }
  return 0
}

function calcFolha(salario: number, bonus: number = 0, valeTransporte: boolean = false) {
  const inssFunc = calcINSS(salario)
  
  const baseIrTradicional = salario - inssFunc
  const irTradicional = Math.max(0, calcIR(baseIrTradicional))
  
  const baseIrSimplificado = salario - 564.80 
  const irSimplificado = Math.max(0, calcIR(baseIrSimplificado))
  
  const ir = Math.min(irTradicional, irSimplificado)
  const vt = valeTransporte ? +(salario * 0.06).toFixed(2) : 0
  const liquido = +(salario - inssFunc - ir + bonus - vt).toFixed(2)
  
  const inssPatronal = +(salario * 0.20).toFixed(2)
  const fgts = +(salario * 0.08).toFixed(2)
  const prov13 = +(salario * 0.0833).toFixed(2)
  const provFerias = +(salario * 0.1111).toFixed(2)
  
  // FIX: Removed ratTerceiros from sum
  const custoTotal = +(salario + bonus + inssPatronal + fgts + prov13 + provFerias).toFixed(2)
  
  return { 
    inssFunc, 
    ir, 
    liquido, 
    custoTotal, 
    bonus, 
    vt,
    inssPatronal,
    fgts,
    prov13,
    provFerias
  }
}

export default function FolhaPagamentoPage() {
  const [funcionarios, setFuncionarios, { loading: isFuncsLoading }] = useSupabaseArray<any>('rh/funcionarios');
  const [adiantamentos = [], , { loading: isAdiantamentosLoading }] = useSupabaseArray<any>('rh/adiantamentos', [])
  const isLoading = isFuncsLoading || isAdiantamentosLoading;
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [search, setSearch] = useState('')
  const [filtroDep, setFiltroDep] = useState('Todos')
  const [processado, setProcessado] = useState(false)
  const [showDetalhe, setShowDetalhe] = useState<string | null>(null)
  const [modalKpi, setModalKpi] = useState<string | null>(null)

  const ANOS = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - 2 + i)
  const departamentos = [...new Set((funcionarios || []).map(f => f.departamento))]

  const ativos = useMemo(() => (funcionarios || []).filter(f =>
    f.status === 'ativo' &&
    (filtroDep === 'Todos' || f.departamento === filtroDep) &&
    (!search || f.nome.toLowerCase().includes(search.toLowerCase()))
  ), [funcionarios, filtroDep, search])

  const folha = useMemo(() => ativos.map(f => {
    const totalAdiantamentos = adiantamentos.reduce((acc, item) => {
      if (item.funcionarioId !== f.id) return acc
      const parcelasDoMes = item.parcelas?.filter((p: any) => {
        const pDate = new Date(p.vencimento + 'T12:00:00Z')
        const matchData = pDate.getMonth() === mes && pDate.getFullYear() === ano
        const matchStatus = p.status === 'pendente' || p.status === 'vencida' || p.status === 'programada'
        const matchForma = p.formaQuitacao ? (p.formaQuitacao === 'desconto_folha' || p.formaQuitacao === 'misto') : true
        return matchData && matchStatus && matchForma
      }) || []
      const sum = parcelasDoMes.reduce((s: number, p: any) => s + p.valor, 0)
      return acc + sum
    }, 0)

    const calc = calcFolha(f.salario, f.bonus || 0, f.valeTransporte || false)
    
    return {
      f,
      ...calc,
      adiantamento: totalAdiantamentos,
      liquido: +(calc.liquido - totalAdiantamentos).toFixed(2)
    }
  }), [ativos, adiantamentos, mes, ano])

  const totalBruto = folha.reduce((s, r) => s + r.f.salario, 0)
  const totalInssFunc = folha.reduce((s, r) => s + r.inssFunc, 0)
  const totalIr = folha.reduce((s, r) => s + r.ir, 0)
  const totalBonus = folha.reduce((s, r) => s + (r.bonus || 0), 0)
  const totalAdiantamentosGeral = folha.reduce((s, r) => s + (r.adiantamento || 0), 0)
  const totalVTGeral = folha.reduce((s, r) => s + (r.vt || 0), 0)
  const totalLiquido = folha.reduce((s, r) => s + r.liquido, 0)
  const totalCusto = folha.reduce((s, r) => s + r.custoTotal, 0)
  
  const totalInssPatronal = folha.reduce((s, r) => s + r.inssPatronal, 0)
  const totalFgts = folha.reduce((s, r) => s + r.fgts, 0)
  const totalProvisoes = folha.reduce((s, r) => s + r.prov13 + r.provFerias, 0)

  const fmtC = formatCurrency
  const det = showDetalhe ? folha.find(r => r.f.id === showDetalhe) : null

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    padding: '20px',
  }

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '32px 20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: '#0f172a' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Folha de Pagamento</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Competência: {MESES[mes]}/{ano} • {ativos.length} colaborador(es) ativo(s)</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ height: '40px', padding: '0 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} /> Exportar
          </button>
          {processado ? (
            <button onClick={() => setProcessado(false)} style={{ height: '40px', padding: '0 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> Folha Processada
            </button>
          ) : (
            <button onClick={() => setProcessado(true)} style={{ height: '40px', padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Banknote size={16} /> Processar Folha
            </button>
          )}
        </div>
      </div>

      {/* CONTROLES DE COMPETÊNCIA */}
      <div style={{ ...cardStyle, display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#2563eb" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>Competência:</span>
        </div>
        <select style={{ ...inputStyle, width: '160px' }} value={mes} onChange={e => { setMes(+e.target.value); setProcessado(false) }}>
          {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select style={{ ...inputStyle, width: '100px' }} value={ano} onChange={e => { setAno(+e.target.value); setProcessado(false) }}>
          {ANOS.map(a => <option key={a}>{a}</option>)}
        </select>
        {processado && (
          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '9999px', background: '#ecfdf5', color: '#047857', fontWeight: 700, border: '1px solid #a7f3d0' }}>
            ✅ Folha processada e fechada
          </span>
        )}
      </div>

      {/* KPIs DE DIRETORIA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { id: 'bruto', label: 'Total Bruto', value: fmtC(totalBruto), color: '#0f172a', bg: '#f8fafc' },
          { id: 'bonus', label: 'Bônus Injetados', value: fmtC(totalBonus), color: '#059669', bg: '#f8fafc' },
          { id: 'retencoes', label: 'Retenções (Adiant./VT)', value: fmtC(totalAdiantamentosGeral + totalVTGeral), color: '#dc2626', bg: '#f8fafc' },
          { id: 'liquido', label: 'Total Líquido', value: fmtC(totalLiquido), color: '#2563eb', bg: '#f8fafc' },
          { id: 'custo', label: 'Custo Real Empresa', value: fmtC(totalCusto), color: '#7c3aed', bg: '#f4f3ff' },
        ].map(k => (
          <div 
            key={k.label} 
            onClick={() => setModalKpi(k.id)}
            style={{ 
              ...cardStyle, 
              background: k.bg, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '4px', 
              border: k.label === 'Custo Real Empresa' ? '1px solid #ddd6fe' : '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            className="kpi-card"
          >
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {k.label}
              <Info size={12} style={{ opacity: 0.5 }} />
            </span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: k.color }}>{k.value}</div>
            
            <style jsx>{`
              .kpi-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                border-color: #cbd5e1;
              }
            `}</style>
          </div>
        ))}
      </div>

      {/* ANÁLISE DE CUSTO PARA O DIRETOR (SEM RAT) */}
      <div style={{ ...cardStyle, marginBottom: '24px', background: '#0f172a', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <PieChart size={18} color="#38bdf8" />
          <span style={{ fontSize: '14px', fontWeight: 700 }}>Visão Consolidada de Custo (Regime Geral Estimado)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', fontSize: '12px' }}>
          <div>
            <div style={{ color: '#94a3b8' }}>Folha Base + Bônus</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{fmtC(totalBruto + totalBonus)}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8' }}>INSS Patronal (20%)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>{fmtC(totalInssPatronal)}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8' }}>FGTS (8%)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fca5a5' }}>{fmtC(totalFgts)}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8' }}>Provisões (13º/Férias)</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fcd34d' }}>{fmtC(totalProvisoes)}</div>
          </div>
        </div>
        <div style={{ marginTop: '16px', fontSize: '11px', color: '#64748b', borderTop: '1px solid #334155', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={12} color="#38bdf8" />
          <span>O "Custo Real" inclui a folha do mês mais a reserva financeira que você deve fazer para cobrir Férias e 13º salário.</span>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ ...cardStyle, padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
          <input style={{ ...inputStyle, width: '100%', paddingLeft: '36px' }} placeholder="Buscar funcionário..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={{ ...inputStyle, width: '200px' }} value={filtroDep} onChange={e => setFiltroDep(e.target.value)}>
          <option value="Todos">Todos departamentos</option>
          {departamentos.map(d => <option key={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{folha.length} funcionário(s) listado(s)</span>
      </div>

      {/* TABELA COMPACTA */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                <th style={{ padding: '10px' }}>Funcionário</th>
                <th style={{ padding: '10px' }}>Depto</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Bruto</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Bônus</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Adiant.</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>VT</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Deduções</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Líquido</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Custo Real</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={6} cols={10} />
              ) : (
                folha.map(({ f, inssFunc, ir, liquido, custoTotal, bonus, adiantamento, vt }) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>{f.nome}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{f.cargo}</div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontSize: '10px', fontWeight: 700 }}>{f.departamento}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>{fmtC(f.salario)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#059669', fontWeight: 700, fontSize: '12px' }}>{bonus > 0 ? `+ ${fmtC(bonus)}` : '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>{adiantamento > 0 ? `- ${fmtC(adiantamento)}` : '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626', fontWeight: 700, fontSize: '12px' }}>{vt > 0 ? `- ${fmtC(vt)}` : '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#64748b', fontSize: '12px' }}>- {fmtC(inssFunc + ir)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#2563eb', fontSize: '13px' }}>{fmtC(liquido)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontSize: '12px' }}>{fmtC(custoTotal)}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button onClick={() => setShowDetalhe(f.id)} style={{ height: '28px', padding: '0 10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={12} /> Holerite
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700, fontSize: '12px' }}>
                  <td colSpan={2} style={{ padding: '10px', textTransform: 'uppercase' }}>Totais</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{fmtC(totalBruto)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#059669' }}>{fmtC(totalBonus)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>- {fmtC(totalAdiantamentosGeral)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>- {fmtC(totalVTGeral)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>- {fmtC(totalInssFunc + totalIr)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#2563eb', fontWeight: 800, fontSize: '13px' }}>{fmtC(totalLiquido)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#7c3aed' }}>{fmtC(totalCusto)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MODAL HOLERITE */}
      <AnimatePresence>
        {det && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.95, opacity:0}} style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '600px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '32px' }}>
                
                {/* Header Holerite */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>IMPACTO EDU</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>CNPJ: 00.000.000/0001-00</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800 }}>RECIBO DE PAGAMENTO</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Competência: {MESES[mes]}/{ano}</div>
                  </div>
                </div>

                {/* Dados Funcionário */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Funcionário</div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{det.f.nome}</div>
                    <div style={{ color: '#475569', marginTop: '4px' }}>{det.f.cargo}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Identificação</div>
                    <div style={{ fontWeight: 700 }}>{det.f.codigo || '—'}</div>
                    <div style={{ color: '#475569', marginTop: '4px' }}>Depto: {det.f.departamento}</div>
                  </div>
                </div>

                {/* Tabela de Lançamentos */}
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Descrição do Evento</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Vencimentos</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Descontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px' }}>Salário Base</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{fmtC(det.f.salario)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
                    </tr>
                    {det.bonus > 0 && (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 8px' }}>Bônus por Desempenho</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{fmtC(det.bonus)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
                      </tr>
                    )}
                    {det.adiantamento > 0 && (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 8px' }}>Adiantamento Salarial Retido</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmtC(det.adiantamento)}</td>
                      </tr>
                    )}
                    {det.vt > 0 && (
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 8px' }}>Desconto Vale Transporte (6%)</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmtC(det.vt)}</td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px' }}>Dedução INSS</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#dc2626' }}>{fmtC(det.inssFunc)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px' }}>Dedução IRRF</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#dc2626' }}>{fmtC(det.ir)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totais e Líquido */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Vencimentos</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>{fmtC(det.f.salario + det.bonus)}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Descontos</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>{fmtC(det.inssFunc + det.ir + det.adiantamento + det.vt)}</div>
                  </div>
                </div>

                {/* Valor Líquido Destacado */}
                <div style={{ background: '#0f172a', padding: '20px', borderRadius: '12px', textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Valor Líquido a Receber</div>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>{fmtC(det.liquido)}</div>
                </div>
              </div>
              
              <div style={{ padding: '16px 32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
                <button style={{ height: '36px', padding: '0 16px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }} onClick={() => setShowDetalhe(null)}>Fechar</button>
                <button style={{ height: '36px', padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => window.print()}><Download size={14} /> Imprimir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DE DETALHAMENTO DE KPI */}
      <AnimatePresence>
        {modalKpi && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.95, opacity:0}} style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {modalKpi === 'bruto' && 'Detalhamento: Total Bruto'}
                    {modalKpi === 'bonus' && 'Detalhamento: Bônus Injetados'}
                    {modalKpi === 'retencoes' && 'Detalhamento: Retenções'}
                    {modalKpi === 'liquido' && 'Cálculo do Total Líquido'}
                    {modalKpi === 'custo' && 'Composição do Custo Real'}
                  </h3>
                  <button onClick={() => setModalKpi(null)} style={{ border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9' }}><X size={16} /></button>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {modalKpi === 'bruto' && (
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <tbody>
                        {folha.map(r => (
                          <tr key={r.f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 0', color: '#475569' }}>{r.f.nome}</td>
                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmtC(r.f.salario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {modalKpi === 'bonus' && (
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <tbody>
                        {folha.filter(r => r.bonus > 0).map(r => (
                          <tr key={r.f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 0', color: '#475569' }}>{r.f.nome}</td>
                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmtC(r.bonus)}</td>
                          </tr>
                        ))}
                        {folha.filter(r => r.bonus > 0).length === 0 && (
                          <tr>
                            <td colSpan={2} style={{ padding: '20px 0', textAlign: 'center', color: '#64748b' }}>Nenhum bônus lançado neste mês.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {modalKpi === 'retencoes' && (
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <tbody>
                        {folha.filter(r => r.adiantamento > 0 || r.vt > 0).map(r => (
                          <tr key={r.f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 0', color: '#475569' }}>
                              <div style={{ fontWeight: 600 }}>{r.f.nome}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                {r.adiantamento > 0 && `Adiantamento: ${fmtC(r.adiantamento)}`}
                                {r.adiantamento > 0 && r.vt > 0 && ' | '}
                                {r.vt > 0 && `VT: ${fmtC(r.vt)}`}
                              </div>
                            </td>
                            <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmtC(r.adiantamento + r.vt)}</td>
                          </tr>
                        ))}
                        {folha.filter(r => r.adiantamento > 0 || r.vt > 0).length === 0 && (
                          <tr>
                            <td colSpan={2} style={{ padding: '20px 0', textAlign: 'center', color: '#64748b' }}>Nenhuma retenção neste mês.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {modalKpi === 'liquido' && (
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}><span>(+) Total Bruto</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtC(totalBruto)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}><span>(+) Bônus</span><span style={{ fontWeight: 700 }}>{fmtC(totalBonus)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>(-) INSS Retido</span><span style={{ fontWeight: 700 }}>-{fmtC(totalInssFunc)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>(-) IRRF Retido</span><span style={{ fontWeight: 700 }}>-{fmtC(totalIr)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>(-) Vale Transporte</span><span style={{ fontWeight: 700 }}>-{fmtC(totalVTGeral)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>(-) Adiantamentos</span><span style={{ fontWeight: 700 }}>-{fmtC(totalAdiantamentosGeral)}</span></div>
                    </div>
                  )}

                  {modalKpi === 'custo' && (
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}><span>(+) Folha Base</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtC(totalBruto)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}><span>(+) Bônus</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtC(totalBonus)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}><span>(+) INSS Patronal (20%)</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtC(totalInssPatronal)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}><span>(+) FGTS (8%)</span><span style={{ fontWeight: 700, color: '#0f172a' }}>{fmtC(totalFgts)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>(+) Provisão 13º (8.33%)</span><span style={{ fontWeight: 700 }}>{fmtC(folha.reduce((s, r) => s + r.prov13, 0))}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}><span>(+) Provisão Férias (11.11%)</span><span style={{ fontWeight: 700 }}>{fmtC(folha.reduce((s, r) => s + r.provFerias, 0))}</span></div>
                    </div>
                  )}
                </div>

                {/* Rodapé do Modal com o Total */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Total do Card</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 
                    modalKpi === 'bruto' ? '#0f172a' :
                    modalKpi === 'bonus' ? '#059669' :
                    modalKpi === 'retencoes' ? '#dc2626' :
                    modalKpi === 'liquido' ? '#2563eb' : '#7c3aed'
                  }}>
                    {modalKpi === 'bruto' && fmtC(totalBruto)}
                    {modalKpi === 'bonus' && fmtC(totalBonus)}
                    {modalKpi === 'retencoes' && fmtC(totalAdiantamentosGeral + totalVTGeral)}
                    {modalKpi === 'liquido' && fmtC(totalLiquido)}
                    {modalKpi === 'custo' && fmtC(totalCusto)}
                  </span>
                </div>
              </div>
              <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
                <button style={{ height: '32px', padding: '0 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }} onClick={() => setModalKpi(null)}>Entendido</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
