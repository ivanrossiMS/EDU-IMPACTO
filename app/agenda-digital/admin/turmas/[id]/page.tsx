'use client'

import { useData } from '@/lib/dataContext'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, Users, ArrowLeft, MessageSquare, Megaphone, Plus, MoreHorizontal, Edit, Key, Lock, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

interface SysUser { id: string; nome: string; email: string; cargo: string; status: 'ativo' | 'inativo' }

export default function ADAdminTurmaDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { turmas, alunos } = useData()
  const { adAlert, adConfirm } = useAgendaDigital()
  const [sysUsers] = useLocalStorage<SysUser[]>('edu-sys-users', [])
  
  const [showProfModal, setShowProfModal] = useState(false)
  const [selectedProf, setSelectedProf] = useState('')

  const turma = (turmas || []).find(t => t.id === id)
  const alunosDaTurma = (alunos || []).filter(a => a.turma === turma?.nome)

  if (!turma) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
        <BookOpen size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Turma não encontrada</h3>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => router.back()}>
           Voltar para Turmas
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 32 }}>
        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#4f46e5', marginBottom: 8 }}>{turma.turno}</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>{turma.nome}</h2>
          <p style={{ color: 'hsl(var(--text-muted))', margin: '4px 0 0 0' }}>Unidade: {turma.unidade}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => router.push(`/agenda-digital/admin/conversas?newChatId=turma-${turma.id}&newChatName=${encodeURIComponent('Turma ' + turma.nome)}`)}><MessageSquare size={16}/> Chat Geral</button>
          <button className="btn btn-primary" onClick={() => router.push('/agenda-digital/admin/comunicados')}><Megaphone size={16}/> Enviar Comunicado</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
         {/* Main Content: Alunos List */}
         <div className="card" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Alunos Vinculados ({alunosDaTurma.length})</h3>
            </div>
            
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', textAlign: 'left' }}>
                  <th style={{ padding: '12px 24px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Aluno</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Responsáveis</th>
                  <th style={{ padding: '12px 24px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {alunosDaTurma.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 600 }}>{a.nome}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>MAT: {a.id.substring(0,6).toUpperCase()}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                       <div style={{ fontSize: 14 }}>{a.responsavelFinanceiro || a.responsavelPedagogico || a.responsavel || 'Não definido'}</div>
                       <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>App Status: {a.status === 'ativo' ? 'Ativo' : 'Pendente'}</div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                       <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                         <Link href={`/agenda-digital/admin/conversas?newChatId=${a.id}&newChatName=${encodeURIComponent(a.nome)}`} className="btn btn-ghost btn-sm" title="Chat Direto">
                           <MessageSquare size={16} />
                         </Link>
                         <button className="btn btn-ghost btn-sm" title="Bloquear App" style={{ color: '#ef4444' }} onClick={() => { adConfirm('Suspender acesso desta família?', 'Bloquear o App', () => adAlert('Conta Suspensa.', 'Ação Concluída')) }}><Lock size={14} /></button>
                       </div>
                    </td>
                  </tr>
                ))}
                {alunosDaTurma.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                       <Users size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                       Nenhum aluno matriculado nesta turma ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
         </div>

         {/* Sidebar: Stats */}
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card" style={{ padding: 24 }}>
               <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0' }}>Engajamento da Turma</h3>
               <div style={{ padding: 16, background: 'rgba(16,185,129,0.05)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', marginBottom: 16 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>85%</div>
                  <div style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>Índice de Leitura Médio</div>
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                     <span style={{ color: 'hsl(var(--text-muted))' }}>Famílias Ativas</span>
                     <span style={{ fontWeight: 600 }}>{alunosDaTurma.filter(a => a.status === 'ativo').length} / {alunosDaTurma.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                     <span style={{ color: 'hsl(var(--text-muted))' }}>Comunicados no Mês</span>
                     <span style={{ fontWeight: 600 }}>4 enviados</span>
                  </div>
               </div>
            </div>

            <div className="card" style={{ padding: 24 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                 <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Corpo Docente</h3>
                 <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setShowProfModal(true)}><Plus size={16} /></button>
               </div>
               
               <div style={{ padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 8, textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                  Nenhum professor alocado à turma.
               </div>
            </div>
         </div>
      </div>
      {showProfModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Alocar Professor (ERP)</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowProfModal(false)}><X size={16}/></button>
             </div>
             <div>
                <label className="form-label">Selecione o usuário do sistema</label>
                <select className="form-input" value={selectedProf} onChange={e => setSelectedProf(e.target.value)}>
                   <option value="">Selecione...</option>
                   {sysUsers.filter(u => u.status === 'ativo').map(u => (
                     <option key={u.id} value={u.id}>{u.nome} ({u.cargo})</option>
                   ))}
                </select>
             </div>
             <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowProfModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => { adAlert('Professor vinculado com sucesso!', 'Sucesso'); setShowProfModal(false); }}>Vincular</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
