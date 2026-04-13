'use client'

import React, { useMemo } from 'react'
import { X, Printer, Download, Mail, MessageCircle, ShieldCheck } from 'lucide-react'
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
    id?: string
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

// ─── Core Helpers ─────────────────────────────────────────────────────────────

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
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

const receiptNumber = (ref: ReceiptParcela) => {
  if (ref.codBaixa) return ref.codBaixa.replace(/\D/g, '').slice(-8).padStart(8, '0')
  return String(Date.now()).slice(-8)
}

// ─── Print HTML Generator (Nível Fintech) ───────────────────────────────────

function buildReceiptHTML(
  parcelas: ReceiptParcela[],
  rawParcelas: ReceiptParcela[],
  aluno: ReceiptProps['aluno'],
  opts: { nomeEscola: string; cnpj: string; logo: string | null; cidade: string; issuerName: string; issuerCargo: string; hash: string }
) {
  const { nomeEscola, cnpj, logo, cidade, issuerName, issuerCargo, hash } = opts
  const ref = rawParcelas[0] || {} as ReceiptParcela
  const totalPago = parcelas.reduce((s, p) => s + (p.valorFinal || p.valor || 0) + (p.juros || 0) + (p.multa || 0), 0)
  const rNum = receiptNumber(ref)
  const emissao = today()
  
  const validationUrl = `https://impacto-edu.com/validar/${hash}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(validationUrl)}&color=0f172a`

  const respNome = aluno.responsavelFinanceiro || aluno.responsavel || aluno.nome || '—'
  const cpf = (aluno as any).cpfResponsavel || aluno.cpf || (aluno as any).cpfRespFin || '—'
  const dtPagto = ref.dtPagto ? new Date(ref.dtPagto + 'T12:00').toLocaleDateString('pt-BR') : today()
  const formaPagto = ref.formaPagto || (ref.formasPagto?.map((f: any) => f.forma).join(', ')) || '—'
  const idFatura = ref.codBaixa || ref.comprovante || String(ref.num ?? '') || '—'

  const infoRow = (label: string, value: string, bold = false) => `
    <div style="margin-bottom:12px;">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${label}</div>
      <div style="font-size:13px;color:#1e293b;${bold ? 'font-weight:700;' : ''}">${value}</div>
    </div>
  `

  const tableRows = parcelas.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding:14px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;font-size:12px">${(p as any).alunoNome ? (p as any).alunoNome + ' — ' : ''}${p.evento || 'Mensalidade'}</div>
        <div style="font-size:10px;color:#64748b;margin-top:4px">Competência: ${p.competencia || '—'} · Parc: ${String(p.num).padStart(2,'0')}</div>
      </td>
      <td style="text-align:right;font-family:'Courier New',monospace;font-size:12px;color:#475569;padding:14px;border-bottom:1px solid #e2e8f0;">R$ ${fmt(p.valor)}</td>
      <td style="text-align:right;font-family:'Courier New',monospace;font-size:12px;color:${p.desconto>0?'#ca8a04':'#94a3b8'};padding:14px;border-bottom:1px solid #e2e8f0;">${p.desconto>0?`- R$ ${fmt(p.desconto)}`:'—'}</td>
      <td style="text-align:right;font-family:'Courier New',monospace;font-size:12px;color:${((p.juros||0)+(p.multa||0))>0?'#dc2626':'#94a3b8'};padding:14px;border-bottom:1px solid #e2e8f0;">${((p.juros||0)+(p.multa||0))>0?`+ R$ ${fmt((p.juros||0)+(p.multa||0))}`:'—'}</td>
      <td style="text-align:right;font-family:'Courier New',monospace;font-weight:800;font-size:13px;color:#16a34a;padding:14px;border-bottom:1px solid #e2e8f0;">R$ ${fmt((p.valorFinal || p.valor || 0) + (p.juros||0) + (p.multa||0))}</td>
    </tr>`).join('')

  const logoHTML = logo 
    ? `<img src="${logo}" style="max-height:60px;max-width:180px;object-fit:contain;"/>`
    : `<div style="font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-1px;">${nomeEscola}</div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo #${rNum}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
    .container {max-width:880px;margin:40px auto;background:#fff;border-radius:24px;box-shadow:0 20px 40px -10px rgba(0,0,0,0.05);overflow:hidden;position:relative;border:1px solid #e2e8f0;}
    .header-border {height:8px;background:linear-gradient(90deg,#0ea5e9 0%,#3b82f6 50%,#8b5cf6 100%);}
    @media print { body{background:#fff;} .container{margin:0;box-shadow:none;border:none;border-radius:0;max-width:100%;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-border"></div>
    <div style="padding:48px;">
      
      <!-- HEADER -->
      <table width="100%" style="margin-bottom:48px;">
        <tr>
          <td valign="top">
            ${logoHTML}
            <div style="margin-top:16px;">
              <span style="background:#f1f5f9;color:#475569;font-size:10px;font-weight:700;padding:6px 12px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">Via Destinada ao Sacado</span>
            </div>
          </td>
          <td align="right" valign="top">
            <div style="font-size:32px;font-weight:900;letter-spacing:-1.5px;color:#0f172a;line-height:1.1;">RECIBO OFICIAL</div>
            <div style="font-size:14px;font-weight:600;color:#64748b;margin-top:8px;">Documento Nº: <span style="color:#0f172a;">#${rNum}</span></div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Emissão: ${emissao}</div>
          </td>
        </tr>
      </table>

      <!-- INFORMAÇÕES FINANCEIRAS -->
      <table width="100%" style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:16px;padding:24px;margin-bottom:40px;">
        <tr>
          <td width="50%" valign="top">
            ${infoRow('Responsável Financeiro', respNome, true)}
            ${infoRow('CPF / CNPJ', cpf)}
            ${infoRow('Forma de Pagamento', formaPagto)}
          </td>
          <td width="30%" valign="top">
            ${infoRow('Referência / ID', idFatura)}
            ${infoRow('Data do Pagamento', dtPagto)}
            <div style="margin-bottom:8px;">
              <div style="font-size:9px;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:4px;">Valor Total Pago</div>
              <div style="font-size:28px;color:#16a34a;font-weight:900;letter-spacing:-1px;">R$ ${fmt(totalPago)}</div>
            </div>
          </td>
          <td width="20%" align="right" valign="top">
            <img src="${qrCodeUrl}" width="100" height="100" style="border-radius:12px;mix-blend-mode:multiply;" alt="QR Code" />
            <div style="font-size:9px;color:#64748b;margin-top:8px;font-family:monospace;line-height:1.4;">Validação digital via QR<br/>Autenticidade Garantida</div>
          </td>
        </tr>
      </table>

      <!-- ALUNO & ESCOLA -->
      <table width="100%" style="border-spacing:0;margin-bottom:40px;">
        <tr>
          <td width="50%" valign="top" style="padding-right:24px;border-right:1px solid #e2e8f0;">
            <div style="font-size:11px;color:#0ea5e9;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Dados do Aluno</div>
            <div style="font-size:15px;font-weight:800;color:#0f172a;">${aluno.nome}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Matrícula: ${aluno.codigo||aluno.matricula||'Não informada'}</div>
          </td>
          <td width="50%" valign="top" style="padding-left:24px;">
            <div style="font-size:11px;color:#8b5cf6;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Instituição de Ensino</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${nomeEscola}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">CNPJ: ${cnpj}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${cidade}</div>
          </td>
        </tr>
      </table>

      <!-- DETALHAMENTO -->
      <div style="font-size:11px;color:#0f172a;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Detalhamento das Parcelas</div>
      <table width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:48px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th align="left" style="padding:14px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;">Ref / Serviço</th>
            <th align="right" style="padding:14px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;">Bruto</th>
            <th align="right" style="padding:14px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;">Descontos</th>
            <th align="right" style="padding:14px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;">Encargos</th>
            <th align="right" style="padding:14px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;">Total Líquido</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- RODAPÉ & ASSINATURAS -->
      <table width="100%" style="margin-top:60px;">
        <tr>
          <td width="33%" valign="bottom">
            <div style="width:100%;height:14px;border-bottom:1px solid #cbd5e1;margin-bottom:8px;">&nbsp;</div>
            <div style="font-size:11px;font-weight:700;color:#0f172a;">${issuerName}</div>
            <div style="font-size:10px;color:#64748b;">${issuerCargo}</div>
          </td>
          <td width="34%"></td>
          <td width="33%" align="right" valign="bottom">
            <div style="font-size:12px;font-weight:600;color:#64748b;">${cidade}, ${dateByExt(todayISO())}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:6px;font-family:monospace;">${hash}</div>
          </td>
        </tr>
      </table>

    </div>
  </div>
  <script>window.onload = function() { window.focus(); }</script>
</body>
</html>`
}

// ─── Sub-Components (Premium Preview Module) ──────────────────────────────────

const GlassContainer = ({ children, className = '' }: any) => (
  <div className={className} style={{
    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 8px 32px rgba(0,0,0,0.02)',
    borderRadius: 20, padding: 24, marginBottom: 24
  }}>{children}</div>
)

const DataField = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
    <span style={{ fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8 }}>{label}</span>
    <span style={{ fontSize:14, color: highlight ? '#0f172a' : '#334155', fontWeight: highlight ? 800 : 600 }}>{value}</span>
  </div>
)

export function ReceiptModal({ parcelas: rawParcelas, aluno, onClose, onBack }: ReceiptProps) {
  const { mantenedores } = useData()

  // ── Flatten if Baixa por Responsável ──
  const parcelas = useMemo(() => {
    return rawParcelas.flatMap((p: any) => {
      if (p.parcelasVinculadas && p.parcelasVinculadas.length > 0) return p.parcelasVinculadas
      return [p]
    })
  }, [rawParcelas])

  // ── Resolve institution data ──
  const mantenedor = (mantenedores as any)?.[0]
  const unidades = mantenedor?.unidades || []
  const unidade = unidades.find((u: any) => u.id === aluno.unidade || u.nome === aluno.unidade) || unidades[0]

  const nomeEscola = unidade?.nomeFantasia || unidade?.razaoSocial || mantenedor?.nome || 'Impacto Edu'
  const cnpj = unidade?.cnpj || mantenedor?.cnpj || '—'
  const logo: string | null = unidade?.cabecalhoLogo || mantenedor?.logo || null
  const cidade = [unidade?.cidade, unidade?.estado].filter(Boolean).join(' - ') || ''

  // ── Issuer ──
  const issuer = (() => {
    if (typeof window === 'undefined') return { nome: 'Secretaria', cargo: 'Administrativo' }
    try {
      const u = JSON.parse(window.localStorage.getItem('edu-current-user') || 'null')
      if (u && u.nome) return { nome: u.nome, cargo: u.cargo || u.perfil || 'Administrativo' }
    } catch {}
    return { nome: 'Secretaria', cargo: 'Administrativo' }
  })()

  // ── Hashes & Dynamics ──
  const emissao = today()
  const ref = rawParcelas[0] || {} as ReceiptParcela
  const totalPago = parcelas.reduce((s, p) => s + (p.valorFinal || p.valor || 0) + (p.juros || 0) + (p.multa || 0), 0)
  const rNum = receiptNumber(ref)
  const hashVal = useMemo(generateUUID, [])
  const validationUrl = `https://impacto-edu.com/validar/${hashVal}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(validationUrl)}&color=0f172a`

  const respNome = aluno.responsavelFinanceiro || aluno.responsavel || aluno.nome || '—'
  const cpf = (aluno as any).cpfResponsavel || aluno.cpf || (aluno as any).cpfRespFin || '—'
  const dtPagto = ref.dtPagto ? new Date(ref.dtPagto + 'T12:00').toLocaleDateString('pt-BR') : today()
  const formaPagto = ref.formaPagto || (ref.formasPagto?.map((f:any)=>f.forma).join(', ')) || '—'
  const idFatura = ref.codBaixa || ref.comprovante || String(ref.num ?? '') || '—'

  // ── Handlers ──
  const openPrintWindow = (autoprint = false) => {
    const html = buildReceiptHTML(parcelas, rawParcelas, aluno, { nomeEscola, cnpj, logo, cidade, issuerName: issuer.nome, issuerCargo: issuer.cargo, hash: hashVal })
    const win = window.open('', '_blank', 'width=900,height=800,scrollbars=yes')
    if (!win) { alert('Permita popups para imprimir o recibo.'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    
    // Força o título para sugerir o nome do PDF na hora de salvar
    win.document.title = `Recibo_${rNum}_${aluno.nome.replace(/\s+/g, '_')}`
    
    if (autoprint) {
      setTimeout(() => { win.focus(); win.print() }, 500)
    } else {
      // Se for "Salvar PDF" e não imprimir em papel, podemos forçar o print também, 
      // mas instruir o usuário a selecionar "Salvar como PDF".
      setTimeout(() => { win.focus(); win.print() }, 500)
    }
  }

  const shareWhatsApp = () => {
    const txt = `*${nomeEscola}*\nOlá, seu recibo nº ${rNum} no valor de R$ ${fmt(totalPago)} pago em ${dtPagto} já está disponível.\n\nAcesse o link abaixo para visualizar e baixar o seu PDF autêntico:\n\n🔗 ${validationUrl}`
    const telRaw = aluno.telResponsavelFinanceiro || (aluno as any).celular || ''
    const tel = telRaw.replace(/\D/g, '')
    // Preenche phone se tiver celular, senão só text
    const url = tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`
    window.open(url, '_blank')
  }

  const shareEmail = () => {
    const targetEmail = aluno.emailResponsavelFinanceiro || (aluno as any).email || ''
    if (targetEmail) {
      navigator.clipboard.writeText(targetEmail)
      alert(`O E-mail (${targetEmail}) foi copiado para a área de transferência!`)
    }
    const subj = `Seu Recibo de Pagamento - ${nomeEscola}`
    const body = `Olá, segue os dados referentes ao comprovante de pagamento.\n\nEscola: ${nomeEscola}\nRecibo: #${rNum}\nValor: R$ ${fmt(totalPago)}\nData: ${dtPagto}\n\nCódigo de Verificação: ${hashVal}\n\nPara segurança, solicite o PDF deste recibo.`
    window.open(`mailto:${targetEmail}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`)
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.65)', backdropFilter:'blur(12px)',
      zIndex:5500, display:'flex', alignItems:'center', justifyContent:'center', padding:24,
    }}>
      <style>{`
        @keyframes fadeInScale { 0% { opacity:0; transform:scale(0.96) translateY(20px) } 100% { opacity:1; transform:scale(1) translateY(0) } }
        .receipt-scroll::-webkit-scrollbar { width:6px; height:6px }
        .receipt-scroll::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:10px }
      `}</style>

      {/* SUPER PREMIUM WRAPPER */}
      <div style={{
        background:'#f8fafc', width:'100%', maxWidth:860, maxHeight:'92vh',
        borderRadius:32, display:'flex', flexDirection:'column', position:'relative',
        boxShadow:'0 40px 100px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,1)',
        border:'1px solid rgba(255,255,255,0.7)',
        animation:'fadeInScale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        overflow:'hidden'
      }}>
        
        {/* TOP LINE ACCENT */}
        <div style={{ height:6, background:'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #f59e0b 100%)', width:'100%' }} />

        {/* HEADER BAR */}
        <div style={{
          padding:'28px 40px', background:'#ffffff', display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          borderBottom:'1px solid #e1e7ef'
        }}>
          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg, #1e293b, #0f172a)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(15,23,42,0.15)' }}>
              <ShieldCheck size={28} color="#38bdf8" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#3b82f6', fontWeight:800, letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Recibo Oficial</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#0f172a', letterSpacing:-1 }}>#{rNum}</div>
            </div>
          </div>
          
          <button onClick={onClose} style={{
            background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#475569',
            width:38, height:38, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.2s'
          }} onMouseEnter={e=>(e.currentTarget.style.background='#e2e8f0')} onMouseLeave={e=>(e.currentTarget.style.background='#f1f5f9')}>
            <X size={18} strokeWidth={2}/>
          </button>
        </div>

        {/* BODY SCROLL */}
        <div className="receipt-scroll" style={{ padding:'32px 40px', flex:1, overflowY:'auto' }}>
          
          {/* IDENTIFICATION GRID */}
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {/* Left Data Column */}
            <div style={{ flex:1, minWidth:300 }}>
              <GlassContainer>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <DataField label="Responsável Finc." value={respNome} highlight />
                  <DataField label="Data da Baixa" value={dtPagto} />
                  <DataField label="CPF" value={cpf} />
                  <DataField label="Pagamento via" value={formaPagto} />
                  <DataField label="ID Fatura" value={idFatura} />
                  <DataField label="Emissão" value={emissao} />
                </div>
              </GlassContainer>
            </div>
            
            {/* Right Summary Column */}
            <div style={{ width:280, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:'linear-gradient(135deg, #059669, #10b981)', borderRadius:20, padding:24, color:'#fff', boxShadow:'0 12px 32px rgba(16,185,129,0.3)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-20, right:-20, opacity:0.1 }}>
                  <ShieldCheck size={120} />
                </div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'rgba(255,255,255,0.8)', marginBottom:6 }}>Total Pago Recebido</div>
                <div style={{ fontSize:32, fontWeight:900, letterSpacing:-1.5 }}>R$ {fmt(totalPago)}</div>
                <div style={{ fontSize:12, fontWeight:500, marginTop:12, background:'rgba(255,255,255,0.15)', display:'inline-block', padding:'4px 10px', borderRadius:20 }}>Transação Concluída ✓</div>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#0f172a', textTransform:'uppercase', letterSpacing:1.5, marginBottom:16 }}>Composição das Parcelas</div>
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 100px', background:'#f8fafc', padding:'12px 20px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:1, borderBottom:'1px solid #e1e7ef' }}>
                <div>Competência / Serviço</div>
                <div style={{ textAlign:'right' }}>Original</div>
                <div style={{ textAlign:'right' }}>Descontos</div>
                <div style={{ textAlign:'right' }}>Encargos</div>
                <div style={{ textAlign:'right' }}>Pago</div>
              </div>
              {parcelas.map((p, i) => {
                const encargos = (Number(p.juros)||0) + (Number(p.multa)||0)
                const isOdd = i % 2 !== 0
                return (
                  <div key={`${p.num}-${i}`} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 100px', padding:'16px 20px', alignItems:'center', background:isOdd?'#f8fafc':'#fff', borderBottom: i<parcelas.length-1?'1px solid #f1f5f9':'none' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{(p as any).alunoNome ? (p as any).alunoNome + ' — ' : ''}{p.evento || 'Mensalidade'}</div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Parc {String(p.num).padStart(2,'0')} · Venc. {p.vencimento} {p.competencia?`· ${p.competencia}`:''}</div>
                    </div>
                    <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:12, color:'#475569' }}>R$ {fmt(p.valor)}</div>
                    <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:12, color:p.desconto>0?'#d97706':'#94a3b8' }}>{p.desconto>0?`-R$ ${fmt(p.desconto)}`:'—'}</div>
                    <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:12, color:encargos>0?'#dc2626':'#94a3b8' }}>{encargos>0?`+R$ ${fmt(encargos)}`:'—'}</div>
                    <div style={{ textAlign:'right', fontFamily:'monospace', fontSize:13, fontWeight:800, color:'#10b981' }}>R$ {fmt((p.valorFinal || p.valor || 0) + encargos)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* VERIFICATION & QR CODE ZONE */}
          <div style={{ display:'flex', marginTop:32, gap:24, alignItems:'center', background:'#f1f5f9', borderRadius:20, padding:20, border:'1px dashed #cbd5e1' }}>
            <img src={qrCodeUrl} width="80" height="80" style={{ borderRadius:12, background:'#fff', padding:4, border:'1px solid #e2e8f0' }} alt="QR Validação"/>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:'#3b82f6', textTransform:'uppercase', letterSpacing:1 }}>Garantia Digital</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginTop:4 }}>Validação via Infraestrutura ERP</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:6, display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontWeight:600, color:'#0f172a' }}>Hash:</span> <span style={{ fontFamily:'monospace' }}>{hashVal}</span>
              </div>
            </div>
            
            <div style={{ marginLeft:'auto', textAlign:'right' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{aluno.nome} {aluno.codigo ? `[${aluno.codigo}]` : ''}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{nomeEscola}</div>
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{cnpj}</div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div style={{ padding:'20px 40px', background:'#ffffff', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          
          <div style={{ display:'flex', gap:12 }}>
            <button onClick={shareWhatsApp} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:14, background:'#ecfdf5', color:'#059669', border:'1px solid #a7f3d0', fontSize:13, fontWeight:700, cursor:'pointer', transition:'0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <MessageCircle size={16}/> Enviar WhatsApp
            </button>
            <button onClick={shareEmail} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:14, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', fontSize:13, fontWeight:700, cursor:'pointer', transition:'0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <Mail size={16}/> E-mail
            </button>
          </div>

          <div style={{ display:'flex', gap:12 }}>
            <button onClick={() => openPrintWindow(false)} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:14, background:'#fff', color:'#475569', border:'1px solid #cbd5e1', fontSize:13, fontWeight:700, cursor:'pointer', transition:'0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <Download size={16}/> Salvar PDF
            </button>
            <button onClick={() => openPrintWindow(true)} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 24px', borderRadius:14, background:'linear-gradient(135deg, #0ea5e9, #3b82f6)', color:'#fff', border:'none', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 8px 24px rgba(59,130,246,0.3)', transition:'0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              <Printer size={16}/> Imprimir Recibo
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
