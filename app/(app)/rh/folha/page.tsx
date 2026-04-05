'use client'

import { useState, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { formatCurrency } from '@/lib/utils'
import {
  Banknote, Search, Filter, Download, ChevronDown, CheckCircle, Clock,
  AlertTriangle, TrendingUp, Users2, DollarSign, Calendar, X, Check, FileText
} from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const ENCARGOS_PCT = 0.2777 // INSS empregador + FGTS aproximado
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

function calcFolha(salario: number) {
  const inssEmp = +((salario * ENCARGOS_PCT)).toFixed(2)
  const inssFunc = calcINSS(salario)
  const fgts = +(salario * 0.08).toFixed(2)
  const baseIr = salario - inssFunc
  const ir = Math.max(0, calcIR(baseIr))
  const liquido = +(salario - inssFunc - ir).toFixed(2)
  const custoTotal = +(salario + inssEmp + fgts).toFixed(2)
  return { inssEmp, inssFunc, fgts, ir, liquido, custoTotal }
}

export default function FolhaPagamentoPage() {
  const { funcionarios } = useData()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [search, setSearch] = useState('')
  const [filtroDep, setFiltroDep] = useState('Todos')
  const [processado, setProcessado] = useState(false)
  const [showDetalhe, setShowDetalhe] = useState<string | null>(null)

  const ANOS = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - 2 + i)
  const departamentos = [...new Set(funcionarios.map(f => f.departamento))]

  const ativos = useMemo(() => funcionarios.filter(f =>
    f.status === 'ativo' &&
    (filtroDep === 'Todos' || f.departamento === filtroDep) &&
    (!search || f.nome.toLowerCase().includes(search.toLowerCase()))
  ), [funcionarios, filtroDep, search])

  const folha = useMemo(() => ativos.map(f => ({
    f,
    ...calcFolha(f.salario),
  })), [ativos])

  const totalBruto = folha.reduce((s, r) => s + r.f.salario, 0)
  const totalInssFunc = folha.reduce((s, r) => s + r.inssFunc, 0)
  const totalIr = folha.reduce((s, r) => s + r.ir, 0)
  const totalLiquido = folha.reduce((s, r) => s + r.liquido, 0)
  const totalCusto = folha.reduce((s, r) => s + r.custoTotal, 0)
  const totalEncargos = totalCusto - totalBruto

  const fmtC = formatCurrency
  const det = showDetalhe ? folha.find(r => r.f.id === showDetalhe) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Folha de Pagamento</h1>
          <p className="page-subtitle">Competência: {MESES[mes]}/{ano} • {ativos.length} colaborador(es) ativo(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar</button>
          {processado
            ? <button className="btn btn-success btn-sm" onClick={() => setProcessado(false)}><CheckCircle size={13} />Processada</button>
            : <button className="btn btn-primary btn-sm" onClick={() => setProcessado(true)}><Banknote size={13} />Processar Folha</button>
          }
        </div>
      </div>

      {/* Controles de competência */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={16} color="#60a5fa" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Competência:</span>
        </div>
        <select className="form-input" style={{ width: 160 }} value={mes} onChange={e => { setMes(+e.target.value); setProcessado(false) }}>
          {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select className="form-input" style={{ width: 100 }} value={ano} onChange={e => { setAno(+e.target.value); setProcessado(false) }}>
          {ANOS.map(a => <option key={a}>{a}</option>)}
        </select>
        {processado && (
          <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>
            ✅ Folha processada • {MESES[mes]}/{ano}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Bruto', value: fmtC(totalBruto), color: '#34d399', icon: '💰' },
          { label: 'INSS (func.)', value: fmtC(totalInssFunc), color: '#f59e0b', icon: '📋' },
          { label: 'IR Retido', value: fmtC(totalIr), color: '#f87171', icon: '🏛️' },
          { label: 'Total Líquido', value: fmtC(totalLiquido), color: '#60a5fa', icon: '💳' },
          { label: 'Custo Empresa', value: fmtC(totalCusto), color: '#a78bfa', icon: '🏢' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: 'Outfit, sans-serif' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barra de encargos */}
      {totalCusto > 0 && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: '#34d399', fontWeight: 700 }}>Salários: {fmtC(totalBruto)}</span>
            <span style={{ color: '#a78bfa', fontWeight: 700 }}>Encargos patronais: {fmtC(totalEncargos)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 8, background: 'hsl(var(--bg-overlay))', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(totalBruto / totalCusto) * 100}%`, background: 'linear-gradient(90deg, #34d399, #60a5fa)', borderRadius: 8 }} />
          </div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 6 }}>
            Custo total empresa: <strong style={{ color: '#a78bfa' }}>{fmtC(totalCusto)}</strong> • Encargos: {((totalEncargos / totalCusto) * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar funcionário..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 180 }} value={filtroDep} onChange={e => setFiltroDep(e.target.value)}>
            <option value="Todos">Todos departamentos</option>
            {departamentos.map(d => <option key={d}>{d}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{folha.length} funcionário(s)</span>
        </div>
      </div>

      {/* Tabela da folha */}
      {ativos.length === 0 ? (
        <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Users2 size={48} style={{ opacity: 0.1, margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nenhum funcionário ativo</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Cadastre funcionários em RH → Funcionários.</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Departamento</th>
                <th style={{ textAlign: 'right' }}>Salário Bruto</th>
                <th style={{ textAlign: 'right' }}>INSS (func.)</th>
                <th style={{ textAlign: 'right' }}>IRRF</th>
                <th style={{ textAlign: 'right' }}>Salário Líquido</th>
                <th style={{ textAlign: 'right' }}>Custo Empresa</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {folha.map(({ f, inssFunc, ir, liquido, custoTotal }) => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.nome}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{f.cargo}</div>
                  </td>
                  <td><span className="badge badge-neutral">{f.departamento}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{fmtC(f.salario)}</td>
                  <td style={{ textAlign: 'right', color: '#f59e0b', fontSize: 13 }}>- {fmtC(inssFunc)}</td>
                  <td style={{ textAlign: 'right', color: '#f87171', fontSize: 13 }}>- {fmtC(ir)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit,sans-serif', fontSize: 14 }}>{fmtC(liquido)}</td>
                  <td style={{ textAlign: 'right', color: '#a78bfa', fontSize: 13 }}>{fmtC(custoTotal)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalhe(f.id)}>
                      <FileText size={12} />Holerite
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                <td colSpan={2} style={{ fontWeight: 800, fontSize: 13, padding: '12px 16px' }}>TOTAIS ({folha.length} funcionários)</td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#34d399', fontSize: 14 }}>{fmtC(totalBruto)}</td>
                <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>- {fmtC(totalInssFunc)}</td>
                <td style={{ textAlign: 'right', color: '#f87171', fontWeight: 700 }}>- {fmtC(totalIr)}</td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit,sans-serif', fontSize: 15 }}>{fmtC(totalLiquido)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#a78bfa' }}>{fmtC(totalCusto)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal Holerite */}
      {det && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 16, width: '100%', maxWidth: 480, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.05))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Holerite — {MESES[mes]}/{ano}</div>
              <button onClick={() => setShowDetalhe(null)} className="btn btn-ghost btn-icon"><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{det.f.nome}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>{det.f.cargo} • {det.f.departamento}</div>
              {[
                { label: 'Salário Bruto', value: det.f.salario, color: '#34d399', sinal: '+' },
                { label: 'INSS (Desconto)', value: det.inssFunc, color: '#f59e0b', sinal: '-' },
                { label: 'IRRF (Desconto)', value: det.ir, color: '#f87171', sinal: '-' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color }}>{row.sinal} {fmtC(row.value)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Salário Líquido</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa', fontFamily: 'Outfit,sans-serif' }}>{fmtC(det.liquido)}</span>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(167,139,250,0.08)', borderRadius: 8, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Custo total empresa (INSS patronal + FGTS): <strong style={{ color: '#a78bfa' }}>{fmtC(det.custoTotal)}</strong>
              </div>
            </div>
            <div style={{ padding: '12px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowDetalhe(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => window.print()}><Download size={13} />Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
