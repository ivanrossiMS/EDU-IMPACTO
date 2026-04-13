'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData } from '@/lib/dataContext'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User, MessageSquare, MoreHorizontal, ShieldAlert, Key, Ban, Mail, Phone, Calendar as CalendarIcon, FileText, Download, TrendingUp, CheckCircle2, Filter } from 'lucide-react'
import Link from 'next/link'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function ADAdminPessoaDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { turmas = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const { adAlert } = useAgendaDigital()

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
  const turmaObj = (turmas || []).find(t => t.nome === aluno.turma)

  // Gerar estatísticas falsas
  const appAdoption = 92
  const readingRate = 88

  // Responsáveis mapeados
  const responsaveis = []
  if (aluno.responsavelFinanceiro) responsaveis.push({ nome: aluno.responsavelFinanceiro, tipo: 'Financeiro', color: '#10b981', badgeBg: 'rgba(16,185,129,0.1)' })
  if (aluno.responsavelPedagogico) responsaveis.push({ nome: aluno.responsavelPedagogico, tipo: 'Pedagógico', color: '#4f46e5', badgeBg: 'rgba(99,102,241,0.1)' })
  if (aluno.responsavel && aluno.responsavel !== aluno.responsavelFinanceiro && aluno.responsavel !== aluno.responsavelPedagogico) {
    responsaveis.push({ nome: aluno.responsavel, tipo: 'Outro', color: 'hsl(var(--text-secondary))', badgeBg: 'hsl(var(--bg-overlay))' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 60 }}>
      {/* Header / Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 32 }}>
        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <div className="avatar" style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--gradient-purple)', color: 'white', fontSize: 32 }}>
           {aluno.nome.charAt(0)}
        </div>
        <div style={{ flex: 1, alignSelf: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>{aluno.nome}</h2>
            {aluno.status === 'matriculado' || aluno.status === 'ativo' ? (
              <span className="badge badge-success" style={{ fontWeight: 700 }}>Ativo no App</span>
            ) : (
              <span className="badge badge-ghost text-muted">Inativo</span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 16, color: 'hsl(var(--text-muted))', fontSize: 14 }}>
            <span>Código: <strong>{((aluno as any).codigo || aluno.matricula)}</strong></span>
            • 
            <span>
              Turma: {' '} 
              {turmaObj ? (
                 <Link href={`/agenda-digital/admin/turmas/${turmaObj.id}`} style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
                   {aluno.turma}
                 </Link>
              ) : (
                 <strong>{aluno.turma}</strong>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href={`/agenda-digital/admin/conversas?newChatId=${aluno.id}&newChatName=${encodeURIComponent(aluno.nome)}`} className="btn btn-secondary"><MessageSquare size={16}/> Enviar Mensagem Direta</Link>
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
                      <div style={{ fontSize: 18, fontWeight: 700 }}>2 Logs</div>
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
                 {/* Timeline Line */}
                 <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: 'hsl(var(--border-subtle))', zIndex: 0 }} />

                 <div style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                       <CheckCircle2 size={20} />
                    </div>
                    <div style={{ paddingTop: 8 }}>
                       <div style={{ fontSize: 14, fontWeight: 600 }}>Responsável (Financeiro) confirmou presença na Reunião de Pais</div>
                       <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Hoje, 11:32</div>
                    </div>
                 </div>

                 <div style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'hsl(var(--bg-overlay))', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid hsl(var(--border-subtle))' }}>
                       <FileText size={18} />
                    </div>
                    <div style={{ paddingTop: 8 }}>
                       <div style={{ fontSize: 14, fontWeight: 600 }}>Visualizou o Comunicado: "Feriado Prolongado"</div>
                       <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Ontem, 08:15</div>
                    </div>
                 </div>

                 <div style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'hsl(var(--bg-overlay))', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid hsl(var(--border-subtle))' }}>
                       <Download size={18} />
                    </div>
                    <div style={{ paddingTop: 8 }}>
                       <div style={{ fontSize: 14, fontWeight: 600 }}>Fez o download do Boleto de Abril gerado</div>
                       <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Segunda-feira</div>
                    </div>
                 </div>

               </div>
               
               <button className="btn btn-secondary" style={{ width: '100%', marginTop: 32 }}>
                  Carregar logs mais antigos
               </button>
            </div>
         </div>

      </div>
    </div>
  )
}
