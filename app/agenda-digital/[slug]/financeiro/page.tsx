'use client'

import { useData, Titulo } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { use, useState, useMemo, useEffect } from 'react'
import { DollarSign, Lock, Download, Copy, Calendar, Tag, QrCode, CheckCircle2, Search, ArrowRight, ArrowUpRight, AlertTriangle, X } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function ADFinanceiroPage({ params }: { params: Promise<{ slug: string }>}) {
  const { alunos, titulos } = useData()
  const { currentUser } = useApp()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  
  const aluno = alunos.find(a => a.id === resolvedParams.slug)
  const [activeTab, setActiveTab] = useState<'abertos' | 'historico'>('abertos')
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear().toString())
  
  // Security Check: Is the current user the financial responsible for this student?
  const myName = (currentUser?.nome || '').toLowerCase().trim()
  const myEmail = (currentUser?.email || '').toLowerCase().trim()
  let isFinancial = false

  if (aluno && currentUser) {
    if ((aluno.responsavelFinanceiro || '').toLowerCase().trim() === myName) isFinancial = true
    if (aluno.emailResponsavelFinanceiro && myEmail && (aluno.emailResponsavelFinanceiro || '').toLowerCase().trim() === myEmail) isFinancial = true
    
    // Check array de responsáveis novo padrão (se houver flag isFinancial)
    const respArr = (aluno as any).responsaveis || (aluno as any)._responsaveis || []
    if (Array.isArray(respArr)) {
       const euNoArray = respArr.find(r => 
         (r.nome && r.nome.toLowerCase().trim() === myName) || 
         (r.email && myEmail && r.email.toLowerCase().trim() === myEmail)
       )
       if (euNoArray && (euNoArray.respFinanceiro || euNoArray.financeiro || euNoArray.tipo === 'Financeiro' || euNoArray.tipo === 'Ambos')) {
         isFinancial = true
       }
    }
  }

  // Se modo de desenvolvimento / adm / fallback
  if (!currentUser || currentUser.perfil === 'Administrador' || currentUser.perfil === 'Gestor' || currentUser.perfil === 'Direção' || currentUser.perfil === 'Secretaria') {
    isFinancial = true
  }

  // Safe date parser to handle both YYYY-MM-DD and DD/MM/YYYY without NaN errors
  const parseDateSafe = (dStr: string) => {
    if (!dStr) return new Date()
    if (dStr.includes('/')) {
      const [dd, mm, yyyy] = dStr.split('/')
      return new Date(`${yyyy}-${mm}-${dd}T12:00:00`)
    }
    const d = new Date(dStr)
    return isNaN(d.getTime()) ? new Date() : d
  }

  // Get data
  const todosMeusTitulos = useMemo(() => {
    if (!aluno) return []
    const nomeAlunoStr = (aluno.nome || '').toLowerCase().trim()
    
    // DEBUG: Checking what is going on
    const matched = titulos.filter(t => {
      const tAluno = (t.aluno || '').toLowerCase().trim()
      const isNomeMatch = tAluno === nomeAlunoStr
      const isIdMatch = t.aluno === aluno.id || (t as any).alunoId === aluno.id
      return isNomeMatch || isIdMatch
    })

    // MAP ALUNO PARCELAS (da Nova Matrícula) p/ Titulo
    const parcelasStudent = (aluno as any).parcelas || []
    const mappedParcelas = parcelasStudent.map((p: any) => {
       return {
         id: p.codigo || `parc-${p.num}-${p.competencia}-${Date.now()}`,
         aluno: aluno.nome,
         responsavel: aluno.responsavelFinanceiro || aluno.responsavel || '',
         descricao: p.evento || 'Mensalidade',
         valor: p.valorFinal ?? p.valor,
         vencimento: p.vencimento,
         pagamento: p.dtPagto || null,
         status: (p.status === 'vencido' || (p.status === 'pendente' && parseDateSafe(p.vencimento) < new Date())) ? 'atrasado' 
                 : (p.status === 'pago' ? 'pago' : 'pendente'),
         metodo: p.formaPagto || null,
         parcela: `${p.num}/${parcelasStudent.length}`,
         nossoNumero: p.codigo || ''
       } as Titulo
    })

    // Merge parcelas de matrícula com Títulos (Contas a Receber)
    const all = [...mappedParcelas, ...matched]
    
    // Deduplicar: Se houver uma parcela e um título com mesmo vencimento e valor e descrição
    const unique = all.filter((v, i, a) => a.findIndex(t => t.vencimento === v.vencimento && t.valor === v.valor && t.descricao === v.descricao) === i)

    console.log('[DEBUG AGENDA FINANCEIRO] =============')
    console.log('[DEBUG] Student ID:', aluno.id)
    console.log('[DEBUG] Student Name:', nomeAlunoStr)
    console.log('[DEBUG] Total titulos in system:', titulos.length)
    console.log('[DEBUG] Total titulos matched:', matched.length)
    console.log('[DEBUG] Mapeadas de aluno.parcelas:', mappedParcelas.length)
    if (unique.length > 0) {
       console.log('[DEBUG] Sample of unique titulos:', unique.slice(-5).map(t => ({ id: t.id, descricao: t.descricao, vencimento: t.vencimento, valor: t.valor })))
    }
    
    return unique.sort((a,b) => parseDateSafe(a.vencimento).getTime() - parseDateSafe(b.vencimento).getTime())
  }, [titulos, aluno])

  const anosDisponiveis = Array.from(new Set(todosMeusTitulos.map(t => parseDateSafe(t.vencimento).getFullYear().toString()))).sort((a,b) => b.localeCompare(a))
  const meusTitulos = todosMeusTitulos.filter(t => parseDateSafe(t.vencimento).getFullYear().toString() === anoFiltro)

  const titulosAbertos = meusTitulos.filter(t => t.status === 'pendente' || t.status === 'atrasado')
  const titulosHistorico = meusTitulos.filter(t => t.status === 'pago')

  const titulosAtrasados = titulosAbertos.filter(t => t.status === 'atrasado' || (t.status === 'pendente' && parseDateSafe(t.vencimento) < new Date()))
  const proximoVencimento = titulosAbertos.length > 0 ? titulosAbertos.sort((a,b) => parseDateSafe(a.vencimento).getTime() - parseDateSafe(b.vencimento).getTime()).find(t => parseDateSafe(t.vencimento) >= new Date()) || titulosAbertos[0] : null
  const totalAberto = titulosAbertos.reduce((acc, curr) => acc + curr.valor, 0)

  // ── Avisos do Sistema em Modal ──
  const [modalAviso, setModalAviso] = useState(false)
  const [hasShownAviso, setHasShownAviso] = useState(false)
  const [modalPix, setModalPix] = useState<{tipo: 'pix'|'codigo', titulo: Titulo} | null>(null)

  useEffect(() => {
    if (titulosAtrasados.length > 0 && !hasShownAviso && isFinancial) {
      setModalAviso(true)
      setHasShownAviso(true)
    }
  }, [titulosAtrasados, hasShownAviso, isFinancial])

  if (!aluno) return null

  if (!isFinancial) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 40 }}>
        <EmptyStateCard 
          title="Acesso Restrito"
          description={`Por motivos de segurança e LGPD, as informações financeiras deste aluno estão restritas apenas ao responsável financeiro principal cadastrado na matrícula. Caso precise de acesso, entre em contato com a secretaria.`}
          icon={<Lock size={64} style={{ opacity: 0.1, color: '#ef4444' }} />}
        />
      </div>
    )
  }

  const TituloCardRow = ({ t }: { t: Titulo }) => {
    const isAtrasado = t.status === 'atrasado' || (t.status === 'pendente' && parseDateSafe(t.vencimento) < new Date())
    const isPago = t.status === 'pago'

    return (
      <div className="ad-fin-card" style={{ 
        background: isAtrasado ? 'rgba(239, 68, 68, 0.05)' : 'hsl(var(--bg-surface))', 
        borderRadius: 16, padding: 20, 
        boxShadow: isAtrasado ? '0 8px 24px rgba(239, 68, 68, 0.15)' : '0 4px 20px rgba(0,0,0,0.03)', 
        border: `1px solid ${isAtrasado ? 'rgba(239, 68, 68, 0.4)' : 'hsl(var(--border-subtle))'}`, 
        display: 'flex', flexDirection: 'column', gap: 16 
      }}>
        <div className="ad-fin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="ad-fin-card-title-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="ad-fin-card-parcela" style={{ fontSize: 13, fontWeight: 700, color: isAtrasado ? '#dc2626' : 'hsl(var(--primary))', background: isAtrasado ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 12 }}>
                {t.parcela || '1/1'}
              </span>
              <span className="ad-fin-card-valor" style={{ fontSize: 18, fontWeight: 800, color: isAtrasado ? '#b91c1c' : 'hsl(var(--text-main))' }}>
                {formatCurrency(t.valor)}
              </span>
            </div>
            <div className="ad-fin-card-desc" style={{ fontSize: 13, color: isAtrasado ? '#dc2626' : 'hsl(var(--text-secondary))', fontWeight: 700 }}>
              {t.descricao}
            </div>
          </div>
          <div className="ad-fin-card-badge-box">
            {isPago ? (
              <span className="badge badge-success" style={{ fontWeight: 600 }}><CheckCircle2 size={12} style={{ marginRight: 4 }}/> Pago</span>
            ) : isAtrasado ? (
              <span className="badge" style={{ fontWeight: 700, background: '#ef4444', color: 'white', padding: '4px 8px' }}>Atrasado</span>
            ) : (
              <span className="badge badge-warning" style={{ fontWeight: 600 }}>Pendente</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: isAtrasado ? '#ef4444' : 'hsl(var(--text-muted))', fontWeight: isAtrasado ? 600 : 400 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
             <Calendar size={14} color={isAtrasado ? '#ef4444' : undefined} />
             {isPago ? `Pago em ${t.pagamento || 'N/A'}` : `Vence em ${formatDate(t.vencimento)}`}
           </div>
           {t.nossoNumero && (
             <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={14} color={isAtrasado ? '#ef4444' : undefined} />
                Nosso N°: {t.nossoNumero}
             </div>
           )}
        </div>

        {!isPago && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setModalPix({tipo: 'pix', titulo: t})}>
              <QrCode size={16} /> Copiar Pix
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setModalPix({tipo: 'codigo', titulo: t})}>
              <Copy size={16} /> Pegar Código
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => window.open(`/api/boletos/${t.id}/pdf`, '_blank')}>
              <Search size={16} /> Abrir Boleto
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="ad-fin-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      
      {/* Resumo Financeiro (Hero) */}
      <div className="ad-fin-hero" style={{ background: 'var(--gradient-primary)', borderRadius: 24, padding: 32, color: 'white', marginBottom: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(50px)' }} />
        <h2 className="ad-fin-hero-title" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, fontFamily: 'Outfit, sans-serif' }}>Central Financeira</h2>
        <p className="ad-fin-hero-desc" style={{ opacity: 0.9, fontSize: 13, marginBottom: 24, maxWidth: '80%' }}>Gerencie e mantenha os pagamentos da mensalidade e taxas extracurriculares em dia com segurança.</p>
        
        <div className="ad-fin-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
           <div style={{ background: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
             <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8, marginBottom: 4 }}>Total em Aberto</div>
             <div style={{ fontSize: 28, fontWeight: 800 }}>{formatCurrency(totalAberto)}</div>
           </div>
           
           <div style={{ background: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
             <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8, marginBottom: 4 }}>Próximo Vencimento</div>
             <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
               {proximoVencimento ? formatDate(proximoVencimento.vencimento) : 'Em dia ✅'}
             </div>
             {proximoVencimento && <div style={{ fontSize: 13, opacity: 0.9 }}>{formatCurrency(proximoVencimento.valor)} • Parcela {proximoVencimento.parcela}</div>}
           </div>
        </div>
      </div>

      <div className="ad-fin-tabs-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid hsl(var(--border-subtle))', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div className="ad-fin-tabs" style={{ display: 'flex', gap: 24 }}>
          <button 
            onClick={() => setActiveTab('abertos')}
            style={{ padding: '12px 0', fontSize: 15, fontWeight: 700, color: activeTab === 'abertos' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', borderBottom: `2px solid ${activeTab === 'abertos' ? 'hsl(var(--primary))' : 'transparent'}`, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
             Mensalidades Abertas ({titulosAbertos.length})
          </button>
          <button 
            onClick={() => setActiveTab('historico')}
            style={{ padding: '12px 0', fontSize: 15, fontWeight: 700, color: activeTab === 'historico' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', borderBottom: `2px solid ${activeTab === 'historico' ? 'hsl(var(--primary))' : 'transparent'}`, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
             Histórico de Pagos
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
           <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Ano Letivo:</span>
           <select className="form-input" style={{ width: 100, padding: '4px 10px', fontSize: 13, height: 32 }} value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)}>
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              {!anosDisponiveis.includes(new Date().getFullYear().toString()) && <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>}
           </select>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {activeTab === 'abertos' ? (
          titulosAbertos.length > 0 ? (
            titulosAbertos.map(t => <TituloCardRow key={t.id} t={t} />)
          ) : (
            <EmptyStateCard 
               title="Tudo certo por aqui!"
               description="Não há nenhuma mensalidade em aberto para este aluno."
               icon={<CheckCircle2 size={48} color="#10b981" style={{ opacity: 0.5 }}/>}
            />
          )
        ) : (
          titulosHistorico.length > 0 ? (
            titulosHistorico.map(t => <TituloCardRow key={t.id} t={t} />)
          ) : (
             <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
               Ainda não há pagamentos registrados neste ano letivo.
             </div>
          )
        )}
      </div>

      {/* ── Modal de Avisos do Sistema ── */}
      {modalAviso && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 24, width: '100%', maxWidth: 440, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                 <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <AlertTriangle size={24} color="#ef4444" />
                 </div>
                 <div>
                   <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-main))' }}>Aviso do Sistema</h3>
                   <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Pendências Financeiras</span>
                 </div>
               </div>
               <button onClick={() => setModalAviso(false)} className="btn btn-ghost btn-icon" style={{ borderRadius: 12 }}>
                 <X size={20} />
               </button>
            </div>
            
            <div style={{ padding: 24, fontSize: 14, color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
               <p style={{ marginBottom: 16 }}>
                 Identificamos que existem <strong>{titulosAtrasados.length} mensalidade(s)</strong> em atraso no sistema para o aluno <strong>{aluno.nome.split(' ')[0]}</strong>.
               </p>
               <p style={{ marginBottom: 0 }}>
                 Para evitar juros, multas ou possíveis bloqueios no acesso pedagógico, recomendamos a regularização o mais breve possível diretamente por esta Central Financeira.
               </p>
            </div>
            
            <div style={{ padding: '16px 24px', background: 'hsl(var(--bg-elevated))', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end' }}>
               <button 
                 onClick={() => setModalAviso(false)}
                 className="btn btn-primary" 
                 style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
               >
                 Estou Ciente
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Copiar Pix / Código ── */}
      {modalPix && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'hsl(var(--bg-base))', borderRadius: 24, width: '100%', maxWidth: 460, border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 40px 120px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                 <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {modalPix.tipo === 'pix' ? <QrCode size={24} color="hsl(var(--primary))" /> : <Copy size={24} color="hsl(var(--primary))" />}
                 </div>
                 <div>
                   <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-main))' }}>
                     {modalPix.tipo === 'pix' ? 'Copiar Chave Pix' : 'Copiar Linha Digitável'}
                   </h3>
                   <span style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>{modalPix.titulo.descricao}</span>
                 </div>
               </div>
               <button onClick={() => setModalPix(null)} className="btn btn-ghost btn-icon" style={{ borderRadius: 12 }}>
                 <X size={20} />
               </button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
               <p style={{ fontSize: 14, color: 'hsl(var(--text-secondary))', lineHeight: 1.5, margin: 0 }}>
                 {modalPix.tipo === 'pix' ? 'Cole a chave Pix abaixo no aplicativo do seu banco para realizar o pagamento instantâneo.' : 'Cole a linha digitável abaixo no aplicativo do seu banco para realizar o pagamento do boleto bancário.'}
               </p>
               
               <div style={{ background: 'rgba(0,0,0,0.03)', padding: 16, borderRadius: 12, border: '1px dashed hsl(var(--border-subtle))', fontFamily: '"JetBrains Mono", monospace', fontSize: 14, wordBreak: 'break-all', textAlign: 'center', fontWeight: 'bold' }}>
                 {modalPix.tipo === 'pix' ? (modalPix.titulo.linhaDigitavel || '00020126360014br.gov.bcb.pix0114000000000005204000053039865400') : (modalPix.titulo.linhaDigitavel || '34191.09008 00000.000000 00000.00000 0 000000000000')}
               </div>

               <button 
                 onMouseLeave={(e) => { e.currentTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" style="margin-right: 8px"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado com sucesso!` }}
                 onClick={(e) => {
                   navigator.clipboard.writeText(modalPix.tipo === 'pix' ? (modalPix.titulo.linhaDigitavel || '00020126') : (modalPix.titulo.linhaDigitavel || '34191'));
                   e.currentTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" style="margin-right: 8px"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado com sucesso!`;
                 }}
                 className="btn btn-primary" 
                 style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
               >
                 <Copy size={18} style={{ marginRight: 8 }} />
                 {modalPix.tipo === 'pix' ? 'Copiar Chave' : 'Copiar Código'}
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

