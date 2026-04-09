'use client'

import React from 'react'
import { X, Printer, Download, CheckCircle } from 'lucide-react'
import { useData } from '@/lib/dataContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptParcela {
  num: number
  evento?: string
  competencia?: string
  vencimento: string
  valor: number
  desconto: number
  valorFinal: number
  juros?: number
  multa?: number
  dtPagto?: string
  formaPagto?: string
  codBaixa?: string
  comprovante?: string
  obs?: string
  status?: string
  formasPagto?: Array<{ id: string; forma: string; valor: string; cartao?: any }>
}

export interface ReceiptProps {
  parcelas: ReceiptParcela[]
  aluno: {
    id: string
    nome: string
    codigo?: string
    matricula?: string
    unidade?: string
    responsavelFinanceiro?: string
    emailResponsavelFinanceiro?: string
    telResponsavelFinanceiro?: string
    responsavel?: string
    cpf?: string
  }
  onClose: () => void
  onBack?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dateByExt = (dateStr: string) => {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  try {
    const d = new Date(dateStr + 'T12:00')
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
  } catch { return dateStr }
}

const today = () => new Date().toLocaleDateString('pt-BR')
const todayISO = () => new Date().toISOString().split('T')[0]

const receiptNumber = (ref: ReceiptParcela) => {
  if (ref.codBaixa) return ref.codBaixa.replace(/\D/g,'').slice(-8).padStart(8,'0')
  return String(Date.now()).slice(-8)
}

// ─── HTML Generator for popup print ─────────────────────────────────────────

function buildReceiptHTML(
  parcelas: ReceiptParcela[],
  aluno: ReceiptProps['aluno'],
  opts: { nomeEscola: string; cnpj: string; logo: string | null; cidade: string; issuerName: string; issuerCargo: string }
) {
  const { nomeEscola, cnpj, logo, cidade, issuerName, issuerCargo } = opts
  const ref = parcelas[0] || {} as ReceiptParcela
  const totalPago = parcelas.reduce((s, p) => s + p.valorFinal + (p.juros || 0) + (p.multa || 0), 0)
  const rNum = receiptNumber(ref)
  const emissao = today()
  const hash = Math.random().toString(36).slice(2,10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase()
  const respNome = aluno.responsavelFinanceiro || aluno.responsavel || aluno.nome || '—'
  const cpf = (aluno as any).cpfResponsavel || aluno.cpf || (aluno as any).cpfRespFin || '—'
  const dtPagto = ref.dtPagto ? new Date(ref.dtPagto+'T12:00').toLocaleDateString('pt-BR') : today()
  const formaPagto = ref.formaPagto || (ref.formasPagto?.map((f: any)=>f.forma).join(', ')) || '—'
  const idFatura = ref.codBaixa || ref.comprovante || String(ref.num ?? '') || '—'

  const tableRows = parcelas.map((p, i) => `
    <tr style="background:${i%2===0?'#fff':'#f8fafc'}">
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">
        <div style="font-weight:700;color:#1e293b;font-size:12px">${p.evento || 'Mensalidade'}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px">Parc. ${String(p.num).padStart(2,'0')} · Venc. ${p.vencimento}</div>
      </td>
      <td style="text-align:right;font-family:monospace;font-size:11px;color:#475569;padding:10px 14px;border-bottom:1px solid #f1f5f9">R$ ${fmt(p.valor)}</td>
      <td style="text-align:right;font-family:monospace;font-size:11px;color:${p.desconto>0?'#d97706':'#94a3b8'};padding:10px 14px;border-bottom:1px solid #f1f5f9">${p.desconto>0?`- R$ ${fmt(p.desconto)}`:'—'}</td>
      <td style="text-align:right;font-family:monospace;font-size:11px;color:${(p.juros||0)>0?'#ef4444':'#94a3b8'};padding:10px 14px;border-bottom:1px solid #f1f5f9">${(p.juros||0)>0?`R$ ${fmt(p.juros!)}`:'—'}</td>
      <td style="text-align:right;font-family:monospace;font-size:11px;color:${(p.multa||0)>0?'#ef4444':'#94a3b8'};padding:10px 14px;border-bottom:1px solid #f1f5f9">${(p.multa||0)>0?`R$ ${fmt(p.multa!)}`:'—'}</td>
      <td style="text-align:right;font-family:monospace;font-weight:800;font-size:12px;color:#059669;padding:10px 14px;border-bottom:1px solid #f1f5f9">R$ ${fmt(p.valorFinal+(p.juros||0)+(p.multa||0))}</td>
    </tr>`).join('')

  const totalDesconto = parcelas.reduce((s,p)=>s+p.desconto,0)
  const totalJuros = parcelas.reduce((s,p)=>s+(p.juros||0),0)
  const totalMulta = parcelas.reduce((s,p)=>s+(p.multa||0),0)
  const totalBruto = parcelas.reduce((s,p)=>s+p.valor,0)

  const logoBlock = logo
    ? `<img src="${logo}" alt="Logo" style="max-width:140px;max-height:60px;object-fit:contain;border-radius:8px"/>`
    : `<div style="padding:10px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;color:#fff;font-size:12px;font-weight:900">${nomeEscola}</div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo #${rNum} — ${aluno.nome}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:#f1f5f9;color:#1e293b;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .page{background:#fff;max-width:800px;margin:32px auto;padding:40px 44px;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.10);border:1px solid #e2e8f0}
    @media print{body{background:#fff}.page{margin:0;padding:32px 40px;box-shadow:none;border:none;border-radius:0;max-width:100%}.no-print{display:none!important}}
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e2e8f0">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:#6366f1;letter-spacing:2px;text-transform:uppercase">Comprovante de Pagamento</div>
          <div style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">Recibo Oficial</div>
        </div>
      </div>
      <div style="display:flex;gap:20px;margin-top:10px">
        <div>
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase">Nº do Recibo</div>
          <div style="font-family:monospace;font-size:14px;font-weight:800;color:#6366f1">#${rNum}</div>
        </div>
        <div>
          <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase">Data de Emissão</div>
          <div style="font-size:12px;font-weight:700;color:#334155">${emissao}</div>
        </div>
      </div>
    </div>
    <div style="text-align:right;max-width:160px">
      ${logoBlock}
      <div style="font-size:9px;color:#94a3b8;margin-top:6px">CNPJ: ${cnpj}</div>
      <div style="font-size:9px;color:#94a3b8">${cidade}</div>
    </div>
  </div>

  <!-- DADOS INSTITUCIONAIS -->
  <div style="background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin-bottom:20px">
    <div style="font-size:9px;color:#3b82f6;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Dados Institucionais</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase">Instituição</div>
        <div style="font-size:13px;font-weight:800;color:#1e3a8a">${nomeEscola}</div>
      </div>
      <div>
        <div style="font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase">CNPJ</div>
        <div style="font-size:12px;font-weight:700;color:#1e293b;font-family:monospace">${cnpj}</div>
      </div>
      <div style="grid-column:1/-1">
        <div style="font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase">Aluno</div>
        <div style="font-size:14px;font-weight:800;color:#1e3a8a">${aluno.nome}${aluno.codigo||aluno.matricula?` <span style="font-size:10px;color:#6366f1;font-family:monospace">#${aluno.codigo||aluno.matricula}</span>`:''}</div>
      </div>
    </div>
  </div>

  <!-- INFO GRID -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
    <div style="display:flex;flex-direction:column;gap:10px">
      ${infoBox('🧾','Nº do Recibo','#'+rNum,true)}
      ${infoBox('👤','Responsável Financeiro',respNome,false)}
      ${infoBox('💳','Forma de Pagamento',formaPagto,false)}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${infoBox('🆔','ID da Fatura',idFatura,true)}
      ${infoBox('📋','CPF do Responsável',cpf,true)}
      ${infoBox('📅','Data do Pagamento',dtPagto,false)}
    </div>
    <!-- Total Destaque -->
    <div style="grid-column:1/-1;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:14px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:9px;color:#16a34a;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Total Recebido</div>
        <div style="font-size:10px;color:#4ade80;margin-top:3px">Pagamento confirmado ✓</div>
      </div>
      <div style="font-size:30px;font-weight:900;color:#15803d;letter-spacing:-1px;font-family:'Inter',monospace">R$ ${fmt(totalPago)}</div>
    </div>
  </div>

  <!-- TABLE -->
  <div style="margin-bottom:20px">
    <div style="font-size:9px;color:#6366f1;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Detalhamento das Parcelas</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="text-align:left;padding:9px 14px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid #e2e8f0">Competência</th>
          <th style="text-align:right;padding:9px 14px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid #e2e8f0">Valor Orig.</th>
          <th style="text-align:right;padding:9px 14px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid #e2e8f0">Desconto</th>
          <th style="text-align:right;padding:9px 14px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid #e2e8f0">Juros</th>
          <th style="text-align:right;padding:9px 14px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid #e2e8f0">Multa</th>
          <th style="text-align:right;padding:9px 14px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:.8px;text-transform:uppercase;border-bottom:1px solid #e2e8f0">Total Pago</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#f8fafc;border-top:2px solid #e2e8f0">
          <td style="padding:10px 14px;font-size:10px;font-weight:700;color:#64748b">TOTAL (${parcelas.length} parcela${parcelas.length!==1?'s':''})</td>
          <td style="text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:#475569;padding:10px 14px">R$ ${fmt(totalBruto)}</td>
          <td style="text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:#d97706;padding:10px 14px">${totalDesconto>0?`- R$ ${fmt(totalDesconto)}`:'—'}</td>
          <td style="text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:#ef4444;padding:10px 14px">${totalJuros>0?`R$ ${fmt(totalJuros)}`:'—'}</td>
          <td style="text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:#ef4444;padding:10px 14px">${totalMulta>0?`R$ ${fmt(totalMulta)}`:'—'}</td>
          <td style="text-align:right;font-family:monospace;font-size:14px;font-weight:900;color:#059669;padding:10px 14px">R$ ${fmt(totalPago)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div style="width:160px;border-bottom:1px solid #cbd5e1;margin-bottom:4px">&nbsp;</div>
      <div style="font-size:9px;color:#64748b;font-weight:700">${issuerName}</div>
      <div style="font-size:8px;color:#94a3b8">${issuerCargo}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;color:#94a3b8">${nomeEscola}</div>
      <div style="font-size:9px;color:#94a3b8">${cidade}, ${dateByExt(todayISO())}</div>
      <div style="font-size:8px;color:#c7d2e1;margin-top:3px;font-family:monospace">hash: ${hash}</div>
    </div>
  </div>

</div>
<script>
  // Auto-print on open and close when done
  window.onload = function() { window.focus(); }
</script>
</body>
</html>`
}

// Tiny helper builder for HTML info boxes (plain string, no JSX)
function infoBox(icon: string, label: string, value: string, mono: boolean) {
  return `<div style="padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
    <div style="font-size:8px;color:#94a3b8;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">${icon} ${label}</div>
    <div style="font-size:12px;font-weight:700;color:#1e293b;${mono?'font-family:monospace;':''}">${value}</div>
  </div>`
}

// ─── Sub-components (for modal preview only) ──────────────────────────────────

const InfoField = ({ icon, label, value, mono }: { icon:string; label:string; value:string; mono?:boolean }) => (
  <div style={{ padding:'10px 12px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
    <div style={{ fontSize:8, color:'#94a3b8', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:3, display:'flex', alignItems:'center', gap:4 }}>
      <span>{icon}</span>{label}
    </div>
    <div style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily: mono ? 'monospace' : 'inherit' }}>
      {value}
    </div>
  </div>
)

const ReceiptInstitutional = ({
  nomeEscola, cnpj, cidade, aluno
}: {
  nomeEscola:string; cnpj:string; cidade:string
  aluno: ReceiptProps['aluno']
}) => (
  <div style={{ background:'linear-gradient(135deg,#eff6ff,#f0f9ff)', border:'1px solid #bfdbfe', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
    <div style={{ fontSize:9, color:'#3b82f6', fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', marginBottom:10 }}>Dados Institucionais</div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
      <div>
        <div style={{ fontSize:9, color:'#64748b', fontWeight:600, letterSpacing:.5, textTransform:'uppercase' }}>Instituição</div>
        <div style={{ fontSize:12, fontWeight:800, color:'#1e3a8a' }}>{nomeEscola}</div>
      </div>
      <div>
        <div style={{ fontSize:9, color:'#64748b', fontWeight:600, letterSpacing:.5, textTransform:'uppercase' }}>CNPJ</div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1e293b', fontFamily:'monospace' }}>{cnpj}</div>
      </div>
      <div style={{ gridColumn:'1/-1' }}>
        <div style={{ fontSize:9, color:'#64748b', fontWeight:600, letterSpacing:.5, textTransform:'uppercase' }}>Aluno</div>
        <div style={{ fontSize:13, fontWeight:800, color:'#1e3a8a' }}>
          {aluno.nome}
          {(aluno.codigo||aluno.matricula) && <span style={{ fontSize:10, color:'#6366f1', marginLeft:8, fontFamily:'monospace' }}>#{aluno.codigo||aluno.matricula}</span>}
        </div>
      </div>
    </div>
  </div>
)

const ReceiptInfoGrid = ({
  totalPago, receiptNum, aluno, ref
}: {
  totalPago: number; receiptNum: string
  aluno: ReceiptProps['aluno']; ref: ReceiptParcela
}) => {
  const respNome = aluno.responsavelFinanceiro || aluno.responsavel || aluno.nome || '—'
  const cpf = (aluno as any).cpfResponsavel || aluno.cpf || (aluno as any).cpfRespFin || '—'
  const dtPagto = ref.dtPagto ? new Date(ref.dtPagto+'T12:00').toLocaleDateString('pt-BR') : today()
  const formaPagto = ref.formaPagto || (ref.formasPagto?.map((f:any)=>f.forma).join(', ')) || '—'
  const idFatura = ref.codBaixa || ref.comprovante || String(ref.num ?? '') || '—'
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <InfoField icon="🧾" label="Nº do Recibo" value={`#${receiptNum}`} mono />
        <InfoField icon="👤" label="Responsável Financeiro" value={respNome} />
        <InfoField icon="💳" label="Forma de Pagamento" value={formaPagto} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <InfoField icon="🆔" label="ID da Fatura" value={idFatura} mono />
        <InfoField icon="📋" label="CPF do Responsável" value={cpf} mono />
        <InfoField icon="📅" label="Data do Pagamento" value={dtPagto} />
      </div>
      <div style={{ gridColumn:'1/-1', background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'2px solid #86efac', borderRadius:14, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:9, color:'#16a34a', fontWeight:700, letterSpacing:1.5, textTransform:'uppercase' }}>Total Recebido</div>
          <div style={{ fontSize:10, color:'#4ade80', marginTop:2 }}>Pagamento confirmado ✓</div>
        </div>
        <div style={{ fontFamily:'Inter,sans-serif', fontSize:28, fontWeight:900, color:'#15803d', letterSpacing:-1 }}>
          R$ {fmt(totalPago)}
        </div>
      </div>
    </div>
  )
}

const ReceiptTable = ({ parcelas, totalPago }: { parcelas: ReceiptParcela[]; totalPago: number }) => {
  const totalBruto = parcelas.reduce((s,p)=>s+p.valor,0)
  const totalDesconto = parcelas.reduce((s,p)=>s+p.desconto,0)
  const totalJuros = parcelas.reduce((s,p)=>s+(p.juros||0),0)
  const totalMulta = parcelas.reduce((s,p)=>s+(p.multa||0),0)
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:9, color:'#6366f1', fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', marginBottom:10 }}>Detalhamento das Parcelas</div>
      <div style={{ border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 80px 80px 80px 90px', background:'#f1f5f9', padding:'8px 14px', fontSize:8, fontWeight:700, color:'#64748b', letterSpacing:.8, textTransform:'uppercase', gap:8, borderBottom:'1px solid #e2e8f0' }}>
          <div>Competência</div>
          <div style={{ textAlign:'right' }}>Valor Orig.</div>
          <div style={{ textAlign:'right' }}>Desconto</div>
          <div style={{ textAlign:'right' }}>Juros</div>
          <div style={{ textAlign:'right' }}>Multa</div>
          <div style={{ textAlign:'right' }}>Total Pago</div>
        </div>
        {parcelas.map((p, i) => (
          <div key={p.num} style={{ display:'grid', gridTemplateColumns:'1fr 90px 80px 80px 80px 90px', padding:'10px 14px', fontSize:12, gap:8, background: i%2===0 ? '#fff' : '#fafafa', borderBottom: i<parcelas.length-1 ? '1px solid #f1f5f9' : 'none', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700, color:'#1e293b', fontSize:12 }}>{p.evento || 'Mensalidade'}</div>
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>Parc. {String(p.num).padStart(2,'0')} · Venc. {p.vencimento}</div>
            </div>
            <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, color:'#475569' }}>R$ {fmt(p.valor)}</div>
            <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, color: p.desconto>0 ? '#d97706' : '#94a3b8' }}>
              {p.desconto>0 ? `- R$ ${fmt(p.desconto)}` : '—'}
            </div>
            <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, color: (p.juros||0)>0 ? '#ef4444' : '#94a3b8' }}>
              {(p.juros||0)>0 ? `R$ ${fmt(p.juros!)}` : '—'}
            </div>
            <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, color: (p.multa||0)>0 ? '#ef4444' : '#94a3b8' }}>
              {(p.multa||0)>0 ? `R$ ${fmt(p.multa!)}` : '—'}
            </div>
            <div style={{ textAlign:'right', fontFamily:'monospace', fontWeight:800, fontSize:12, color:'#059669' }}>
              R$ {fmt(p.valorFinal + (p.juros||0) + (p.multa||0))}
            </div>
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 80px 80px 80px 90px', padding:'10px 14px', background:'#f8fafc', borderTop:'2px solid #e2e8f0', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#64748b' }}>TOTAL ({parcelas.length} parcela{parcelas.length!==1?'s':''})</div>
          <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#475569' }}>R$ {fmt(totalBruto)}</div>
          <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#d97706' }}>{totalDesconto>0?`- R$ ${fmt(totalDesconto)}`:'—'}</div>
          <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#ef4444' }}>{totalJuros>0?`R$ ${fmt(totalJuros)}`:'—'}</div>
          <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#ef4444' }}>{totalMulta>0?`R$ ${fmt(totalMulta)}`:'—'}</div>
          <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:13, fontWeight:900, color:'#059669' }}>R$ {fmt(totalPago)}</div>
        </div>
      </div>
    </div>
  )
}

const ReceiptFooter = ({ nomeEscola, cidade, issuerName, issuerCargo }: { nomeEscola:string; cidade:string; issuerName:string; issuerCargo:string }) => (
  <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:16, marginTop:8 }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
      <div>
        <div style={{ width:160, borderBottom:'1px solid #cbd5e1', marginBottom:4 }} />
        <div style={{ fontSize:9, color:'#64748b', fontWeight:700 }}>{issuerName}</div>
        <div style={{ fontSize:8, color:'#94a3b8' }}>{issuerCargo}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:9, color:'#94a3b8' }}>{nomeEscola}</div>
        <div style={{ fontSize:9, color:'#94a3b8' }}>{cidade}, {dateByExt(todayISO())}</div>
      </div>
    </div>
  </div>
)

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReceiptModal({ parcelas, aluno, onClose, onBack }: ReceiptProps) {
  const { mantenedores } = useData()

  // ── Resolve institution data ──
  const mantenedor = (mantenedores as any)?.[0]
  const unidades = mantenedor?.unidades || []
  const unidade = unidades.find((u: any) => u.id === aluno.unidade || u.nome === aluno.unidade) || unidades[0]

  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Impacto Edu'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || '—'
  const logo: string | null = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const cidade = [unidade?.cidade, unidade?.estado].filter(Boolean).join(' - ') || ''

  // ── Logged-in user (issuer of the receipt) — from localStorage session ──
  const issuer = (() => {
    if (typeof window === 'undefined') return { nome: 'Secretaria', cargo: 'Administrativo' }
    try {
      const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null')
      if (u && u.nome) return { nome: u.nome, cargo: u.cargo || u.perfil || 'Administrativo' }
    } catch {}
    return { nome: 'Secretaria', cargo: 'Administrativo' }
  })()
  const issuerName  = issuer.nome
  const issuerCargo = issuer.cargo

  const ref = parcelas[0] || {} as ReceiptParcela
  const totalPago = parcelas.reduce((s, p) => s + p.valorFinal + (p.juros || 0) + (p.multa || 0), 0)
  const rNum = receiptNumber(ref)

  // ── Open print popup — content in a fresh blank window, no app interference ──
  const openPrintWindow = (autoprint = false) => {
    const html = buildReceiptHTML(parcelas, aluno, { nomeEscola, cnpj, logo, cidade, issuerName, issuerCargo })
    const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
    if (!win) { alert('Permita popups para imprimir o recibo.'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    if (autoprint) {
      win.onload = () => { win.focus(); win.print() }
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(2,6,23,0.92)', zIndex:5500,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      backdropFilter:'blur(8px)',
    }}>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* Card */}
      <div style={{
        background:'#ffffff', borderRadius:24, width:'100%', maxWidth:680,
        maxHeight:'94vh', overflowY:'auto',
        border:'1px solid rgba(99,102,241,0.25)',
        boxShadow:'0 50px 150px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)',
        display:'flex', flexDirection:'column',
        animation:'slideUp 0.22s ease',
        fontFamily:"'Inter',system-ui,sans-serif",
      }}>

        {/* Top Bar */}
        <div style={{
          background:'linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4)',
          borderRadius:'24px 24px 0 0', padding:'20px 28px',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, background:'rgba(255,255,255,0.2)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🧾</div>
            <div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', fontWeight:700, letterSpacing:2, textTransform:'uppercase' }}>Comprovante de Pagamento</div>
              <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:-0.5 }}>Recibo Oficial #{rNum}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
            width:32, height:32, borderRadius:16,
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}><X size={16}/></button>
        </div>

        {/* Body — preview */}
        <div style={{ padding:'28px', flex:1, overflowY:'auto' }}>
          <ReceiptInstitutional nomeEscola={nomeEscola} cnpj={cnpj} cidade={cidade} aluno={aluno} />
          <ReceiptInfoGrid totalPago={totalPago} receiptNum={rNum} aluno={aluno} ref={ref} />
          <ReceiptTable parcelas={parcelas} totalPago={totalPago} />
          {/* Obs */}
          {(ref.obs || (ref as any).obsFin) && (
            <div style={{ marginBottom:20, padding:'12px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10 }}>
              <div style={{ fontSize:9, color:'#d97706', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>Observação</div>
              <div style={{ fontSize:12, color:'#92400e' }}>{ref.obs || (ref as any).obsFin}</div>
            </div>
          )}
          <ReceiptFooter nomeEscola={nomeEscola} cidade={cidade} issuerName={issuerName} issuerCargo={issuerCargo} />
        </div>

        {/* Action Footer */}
        <div style={{
          padding:'16px 28px', background:'#f8fafc',
          borderTop:'1px solid #e2e8f0', borderRadius:'0 0 24px 24px',
          display:'flex', justifyContent:'space-between', gap:10, flexShrink:0,
        }}>
          <div>
            {onBack && (
              <button onClick={onBack} style={{
                padding:'8px 16px', borderRadius:12, border:'1px solid #e2e8f0',
                background:'#fff', color:'#475569', cursor:'pointer', fontSize:12, fontWeight:600,
              }}>← Voltar</button>
            )}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {/* Download: open popup without autoprint so user can Ctrl+S to PDF */}
            <button onClick={() => openPrintWindow(false)} style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'8px 18px', borderRadius:12, border:'1px solid #c7d2fe',
              background:'#eff6ff', color:'#6366f1', cursor:'pointer', fontSize:12, fontWeight:700,
            }}><Download size={14}/> Abrir PDF</button>

            {/* Print: open popup and trigger print dialog */}
            <button onClick={() => openPrintWindow(true)} style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'8px 20px', borderRadius:12, border:'none',
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff',
              cursor:'pointer', fontSize:12, fontWeight:700,
              boxShadow:'0 4px 14px rgba(99,102,241,0.4)',
            }}><Printer size={14}/> Imprimir / PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}
