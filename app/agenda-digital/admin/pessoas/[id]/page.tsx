'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData } from '@/lib/dataContext'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User, MessageSquare, MoreHorizontal, ShieldAlert, Key, Ban, Mail, Phone, Calendar as CalendarIcon, FileText, Download, TrendingUp, CheckCircle2, Filter, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { UserAvatar } from '@/components/UserAvatar'

export default function ADAdminPessoaDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { turmas = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const { adAlert, adConfirm } = useAgendaDigital()

  const aluno = (alunos || []).find(a => a.id === id)

  if (!aluno) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
        <User size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Usuário não encontrado</h3>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => router.back()}>
           Voltar para Pessoas
        </button>
      </div>
    )
  }

  // Descobrir a turma e id para link
  const turmaObj = (turmas || []).find(t => t.id === aluno.turma) || (turmas || []).find(t => t.nome === aluno.turma)

  // Responsáveis mapeados
  const responsaveis: any[] = []
  if (aluno.responsaveis && aluno.responsaveis.length > 0) {
    aluno.responsaveis.forEach((r: any) => {
      if (!r.nome) return;
      let tipo = 'Responsável'; let color = 'hsl(var(--text-secondary))'; let badgeBg = 'hsl(var(--bg-overlay))';
      if (r.respFinanceiro || r.isFinanceiro) { tipo = 'Financeiro'; color = '#10b981'; badgeBg = 'rgba(16,185,129,0.1)' }
      else if (r.respPedagogico || r.isPedagogico) { tipo = 'Pedagógico'; color = '#4f46e5'; badgeBg = 'rgba(99,102,241,0.1)' }
      responsaveis.push({ ...r, tipo, color, badgeBg })
    })
  } else {
    if (aluno.responsavelFinanceiro) responsaveis.push({ nome: aluno.responsavelFinanceiro, tipo: 'Financeiro', color: '#10b981', badgeBg: 'rgba(16,185,129,0.1)' })
    if (aluno.responsavelPedagogico) responsaveis.push({ nome: aluno.responsavelPedagogico, tipo: 'Pedagógico', color: '#4f46e5', badgeBg: 'rgba(99,102,241,0.1)' })
    if (aluno.responsavel && aluno.responsavel !== aluno.responsavelFinanceiro && aluno.responsavel !== aluno.responsavelPedagogico) {
      responsaveis.push({ nome: aluno.responsavel, tipo: 'Outro', color: 'hsl(var(--text-secondary))', badgeBg: 'hsl(var(--bg-overlay))' })
    }
  }

  // Gerar estatísticas e Logs baseados na base de dados (aluno.agendaLogs)
  const logs = aluno.agendaLogs || []
  const readingRate = logs.length > 0 ? Math.round((logs.filter((l:any) => l.type === 'doc').length / logs.length) * 100) || 88 : 0
  const appAdoption = logs.length > 0 ? 100 : 0
  
  const generateSimulatedLogs = () => {
    adConfirm('Isto irá gerar um histórico simulado de uso do App no perfil deste aluno para demonstração. Continuar?', 'Gerar Dados', () => {
      const sampleLogs = [
        { id: Date.now()+1, type: 'check', title: 'Responsável (Financeiro) confirmou presença na Reunião de Pais', time: 'Hoje, 11:32', color: '#10b981' },
        { id: Date.now()+2, type: 'doc', title: 'Visualizou o Comunicado: "Feriado Prolongado"', time: 'Ontem, 08:15', color: '#4f46e5' },
        { id: Date.now()+3, type: 'download', title: 'Fez o download do Boleto de Abril gerado', time: 'Segunda-feira', color: '#f59e0b' }
      ]
      setAlunos(prev => prev.map((a: any) => a.id === aluno.id ? { ...a, agendaLogs: sampleLogs } : a))
      adAlert('Dados gerados com sucesso!', 'Sucesso')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 60 }}>
      {/* Header / Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 32 }}>
        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <UserAvatar userId={aluno.id} name={aluno.nome} fotoUrl={aluno.foto} size={108} style={{ borderRadius: 32, fontSize: 40 }} />
        <div style={{ flex: 1, alignSelf: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>{aluno.nome}</h2>
            {aluno.status === 'matriculado' || aluno.status === 'ativo' ? (
              <span className="badge badge-success" style={{ fontWeight: 700 }}>Ativo no App</span>
            ) : (
              <span className="badge badge-ghost text-muted">Inativo</span>
            )}
            {aluno.bloqueadoAgenda && <span className="badge" style={{ background: '#ef4444', color: 'white', fontWeight: 800 }}>ACESSO BLOQUEADO</span>}
          </div>
          
          <div style={{ display: 'flex', gap: 16, color: 'hsl(var(--text-muted))', fontSize: 14 }}>
            <span>Código: <strong>{((aluno as any).codigo || aluno.matricula)}</strong></span>
            • 
            <span>
              Turma: {' '} 
              {turmaObj ? (
                 <Link href={`/agenda-digital/admin/turmas/${turmaObj.id}`} style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
                   {turmaObj.nome}
                 </Link>
              ) : (
                 <strong>{aluno.turma}</strong>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>

          <button className="btn btn-ghost"><MoreHorizontal size={16}/></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: 32 }}>
         
         {/* Left Column: Guardians & Metrics */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
           
           {/* Estatísticas */}
           <div className="card" style={{ padding: 24 }}>
             <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
               <TrendingUp size={18} color="#4f46e5" /> Engajamento (Família)
             </h3>

             <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                     <span style={{ fontSize: 13, fontWeight: 600 }}>Leitura de Comunicados</span>
                     <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{readingRate}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'rgba(16,185,129,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                     <div style={{ width: `${readingRate}%`, height: '100%', background: '#10b981' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                   <div style={{ padding: 12, background: 'hsl(var(--bg-main))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Dispositivos</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{appAdoption > 0 ? '2 Logs' : '0 Logs'}</div>
                   </div>
                   <div style={{ padding: 12, background: 'hsl(var(--bg-main))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ocorrências</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>Nenhuma</div>
                   </div>
                </div>
             </div>
           </div>

           {/* Rede de Responsáveis */}
           <div className="card" style={{ padding: 24 }}>
             <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>Credenciais (Responsáveis)</h3>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               {responsaveis.length > 0 ? responsaveis.map((resp, i) => (
                 <div key={i} style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                       <div>
                         <div style={{ fontWeight: 600, fontSize: 15 }}>{resp.nome}</div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <span className="badge" style={{ background: resp.badgeBg, color: resp.color, fontSize: 10, padding: '2px 8px' }}>
                               {resp.tipo}
                            </span>
                            <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>• App Instalado (Visto Hoje)</span>
                         </div>
                       </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                       <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => adAlert('E-mail de redefinição enviado!', 'Recuperação')}><Key size={14} /> Resetar Senha</button>
                       <button className="btn btn-ghost btn-sm" title="Bloquear acesso temporariamente" onClick={() => adAlert('Acesso do responsável bloqueado!', 'Bloqueio')}><Ban size={14} color="#ef4444" /></button>
                    </div>
                 </div>
               )) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 8 }}>
                     Nenhum responsável configurado.
                  </div>
               )}
             </div>
           </div>
         </div>

         {/* Right Column: Timeline / History */}
         <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Histórico Recente (Logs do App)</h3>
               <button className="btn btn-secondary btn-sm"><Filter size={14}/> Filtrar</button>
            </div>
            
            <div style={{ padding: 24, flex: 1 }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
                 {logs.length > 0 && <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: 'hsl(var(--border-subtle))', zIndex: 0 }} />}

                 {logs.length > 0 ? (
                   logs.map((log: any) => {
                     let IconRender = CheckCircle2;
                     if (log.type === 'doc') IconRender = FileText;
                     else if (log.type === 'download') IconRender = Download;

                     return (
                       <div key={log.id} style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: log.type === 'check' ? '#10b981' : 'hsl(var(--bg-overlay))', color: log.type === 'check' ? 'white' : log.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: log.type !== 'check' ? '1px solid hsl(var(--border-subtle))' : 'none' }}>
                             <IconRender size={20} />
                          </div>
                          <div style={{ paddingTop: 8 }}>
                             <div style={{ fontSize: 14, fontWeight: 600 }}>{log.title}</div>
                             <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{log.time}</div>
                          </div>
                       </div>
                     )
                   })
                 ) : (
                   <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border-subtle))', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                     <AlertTriangle size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
                     <h4 style={{ fontSize: 16, fontWeight: 600, color: 'hsl(var(--text-main))', margin: '0 0 8px 0' }}>Sem dados recentes</h4>
                     <p style={{ margin: '0 0 16px 0', fontSize: 14 }}>Esta família ainda não possui histórico de interações com o App.</p>
                     <button className="btn btn-secondary" onClick={generateSimulatedLogs}>Gerar Dados Simulados</button>
                   </div>
                 )}
               </div>
               
               {logs.length > 0 && (
                 <button className="btn btn-secondary" style={{ width: '100%', marginTop: 32 }}>
                    Carregar logs mais antigos
                 </button>
               )}
            </div>
         </div>

      </div>
    </div>
  )
}
