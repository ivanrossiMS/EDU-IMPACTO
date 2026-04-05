'use client'

import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Bell, AlertTriangle, Calendar, ChevronRight } from 'lucide-react'

export default function SelecionarAluno() {
  const { alunos, titulos, turmas } = useData()
  const { currentUser } = useApp()
  const router = useRouter()

  useEffect(() => {
    // Se o usuário logado for de fato um aluno (cargo === 'Aluno'), redireciona ele automaticamente
    if (currentUser?.cargo === 'Aluno') {
      const nomeLower = (currentUser.nome || '').toLowerCase().trim()
      const myAluno = alunos.find(a => 
        (a.nome || '').toLowerCase().trim() === nomeLower || 
        (currentUser.id && currentUser.id.includes(String(a.id)))
      )
      if (myAluno) {
        router.replace(`/agenda-digital/${myAluno.id}/comunicados`)
      }
    }
  }, [currentUser, alunos, router])

  let meusAlunos = alunos.filter(a => a.status === 'matriculado' || a.status === 'ativo')

  if (currentUser && (currentUser.perfil === 'Responsável' || currentUser.perfil === 'Família')) {
    const nomeBusca = (currentUser.nome || '').toLowerCase().trim()
    const emailBusca = (currentUser.email || '').toLowerCase().trim()

    meusAlunos = meusAlunos.filter(a => {
      if (a.responsavel && a.responsavel.toLowerCase().trim() === nomeBusca) return true
      if (a.emailResponsavel && emailBusca && a.emailResponsavel.toLowerCase().trim() === emailBusca) return true
      if (a.responsavelFinanceiro && a.responsavelFinanceiro.toLowerCase().trim() === nomeBusca) return true
      if (a.responsavelPedagogico && a.responsavelPedagogico.toLowerCase().trim() === nomeBusca) return true

      // Checa array de responsáveis se existir
      const respArr = (a as any).responsaveis || (a as any)._responsaveis || []
      if (Array.isArray(respArr)) {
        return respArr.some(r => 
          (r.nome && r.nome.toLowerCase().trim() === nomeBusca) ||
          (r.email && emailBusca && r.email.toLowerCase().trim() === emailBusca) ||
          (r.emailResponsavel && emailBusca && r.emailResponsavel.toLowerCase().trim() === emailBusca)
        )
      }

      return false
    })
  } else if (!currentUser || (currentUser.perfil !== 'Família' && currentUser.perfil !== 'Responsável')) {
    // Para administradores (apenas para simulação do protótipo) mostra no máximo 3 alunos
    meusAlunos = meusAlunos.slice(0, 3)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingTop: '8vh', paddingBottom: 60, animation: 'fadeUp 0.8s ease-out forwards', opacity: 0 }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        @keyframes floatAvatar {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .premium-card {
          padding: 28px 32px;
          display: flex;
          align-items: center;
          gap: 24px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(145deg, hsl(var(--bg-surface)), rgba(139,92,246,0.04));
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.04);
          position: relative;
          overflow: hidden;
        }
        .premium-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.08), transparent);
          transform: translateX(-100%);
          transition: transform 0.7s;
        }
        .premium-card:hover {
          transform: translateY(-8px) scale(1.015);
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 24px 48px rgba(99, 102, 241, 0.12), inset 0 1px 0 rgba(255,255,255,0.15);
          background: linear-gradient(145deg, hsl(var(--bg-surface)), rgba(99,102,241,0.06));
        }
        .premium-card:hover::before {
          transform: translateX(100%);
        }
        .premium-card:hover .chevron-icon {
          transform: translateX(6px);
          color: hsl(var(--primary));
        }
        .premium-card:hover .avatar-glow {
          box-shadow: 0 8px 24px rgba(139,92,246,0.3);
        }
        .gradient-text {
          background: linear-gradient(135deg, hsl(var(--text-main)) 20%, hsl(var(--primary)) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .premium-card-avatar {
          animation: floatAvatar 3s ease-in-out infinite;
        }
        
        /* Mobile Optimizaton */
        @media (max-width: 768px) {
          .header-card {
            padding: 20px 24px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            margin-bottom: 24px !important;
          }
          .header-card h1 {
            font-size: 22px !important;
          }
          .header-card p {
            font-size: 14px !important;
            min-width: 100% !important;
          }
          
          .premium-card {
            padding: 20px 16px !important;
            gap: 12px !important;
          }
          .premium-card-avatar {
            width: 56px !important;
            height: 56px !important;
          }
          .premium-card-content {
            min-width: 0 !important;
          }
          .premium-card-name {
            font-size: 16px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .premium-card-meta {
            font-size: 12px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .premium-card-icons {
            gap: 6px !important;
          }
          .premium-card-icon-btn {
            width: 36px !important;
            height: 36px !important;
            border-radius: 12px !important;
          }
          .premium-card-icon-btn > svg {
            width: 18px !important;
            height: 18px !important;
          }
          .badge-counter {
            width: 18px !important;
            height: 18px !important;
            font-size: 10px !important;
            top: -4px !important;
            right: -4px !important;
          }
        }
      `}} />

      {/* Header Card */}
      <div className="header-card" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 24,
        padding: '24px 32px',
        background: 'linear-gradient(145deg, hsl(var(--bg-surface)), rgba(139,92,246,0.03))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        boxShadow: '0 12px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.08)',
        marginBottom: 48,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))', color: 'hsl(var(--primary))', boxShadow: '0 8px 24px rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)', position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 20, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
          <Calendar size={32} strokeWidth={1.5} />
        </div>
        
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em', margin: 0, whiteSpace: 'nowrap', color: 'hsl(var(--text-main))' }}>
            Acesso da Família
          </h1>
          
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)', display: 'block' }} className="desktop-divider" />
          
          <p style={{ fontSize: 16, color: 'hsl(var(--text-secondary))', margin: 0, lineHeight: 1.5, fontWeight: 500, flex: 1, minWidth: 280 }}>
            Selecione o aluno abaixo para acessar a agenda individual digital do aluno
          </p>
        </div>
        
        {/* Adiciona media query via style global só pra esconder a linha vertical no mobile */}
        <style dangerouslySetInnerHTML={{__html: `
          @media (max-width: 640px) {
            .desktop-divider { display: none !important; }
          }
        `}} />
      </div>

      {currentUser && currentUser.perfil !== 'Família' && currentUser.perfil !== 'Responsável' && currentUser.cargo !== 'Aluno' && (
        <div style={{ marginBottom: 32, animation: 'fadeUp 0.6s ease-out 0.1s forwards', opacity: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 16 }}>Acesso Funcional</h2>
          <Link href={`/agenda-digital/colaborador/comunicados`} style={{ textDecoration: 'none' }}>
            <div className="premium-card">
              <div className="premium-card-avatar avatar-glow" style={{ position: 'relative', width: 72, height: 72, borderRadius: 20, fontSize: 26, fontWeight: 800, background: 'linear-gradient(135deg, hsl(var(--primary)), #3b82f6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s', overflow: 'hidden', boxShadow: '0 8px 24px rgba(59,130,246,0.15)' }}>
                {getInitials(currentUser.nome || 'Colaborador')}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 20, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
              </div>
              
              <div className="premium-card-content" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div className="premium-card-name" style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 6, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.nome || 'Seu Perfil Colaborador'}
                </div>
                <div className="premium-card-meta" style={{ fontSize: 14, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
                  <span style={{ color: 'hsl(var(--primary))' }}>Acesso Institucional</span> • {currentUser.cargo || currentUser.perfil || 'Membro da Equipe'}
                </div>
              </div>

              <div className="premium-card-icons" style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                <div className="premium-card-icon-btn chevron-icon" style={{ width: 48, height: 48, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                  <ChevronRight size={22} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {(meusAlunos.length > 0 || (currentUser && (currentUser.perfil === 'Responsável' || currentUser.perfil === 'Família'))) && (
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 16, opacity: 0, animation: 'fadeUp 0.6s ease-out 0.2s forwards' }}>Acesso Familiar</h2>
      )}

      {meusAlunos.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: 'linear-gradient(145deg, hsl(var(--bg-surface)), transparent)', borderRadius: 32, border: '1px dashed hsl(var(--border-subtle))' }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <AlertTriangle size={40} color="hsl(var(--text-muted))" opacity={0.5} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 12 }}>Nenhum aluno encontrado</h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: 15, maxWidth: 360, margin: '0 auto' }}>
            Verifique se sua conta foi corretamente vinculada aos seus filhos na Secretaria. <br /><br />
            Responsável autenticado:<br /> <strong style={{ color: 'hsl(var(--text-main))' }}>{currentUser?.nome}</strong>
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {meusAlunos.map((a, index) => {
            const titulosAluno = titulos.filter(t => t.aluno === a.nome || (t as any).alunoId === a.id)
            const pendentes = titulosAluno.filter(t => t.status === 'atrasado')

            return (
              <Link key={a.id} href={`/agenda-digital/${a.id}/comunicados`} style={{ textDecoration: 'none', animation: 'fadeUp 0.6s ease-out ' + (0.1 + index * 0.15) + 's forwards', opacity: 0 }}>
                <div className="premium-card">
                  <div className="premium-card-avatar avatar-glow" style={{ position: 'relative', width: 72, height: 72, borderRadius: 20, fontSize: 26, fontWeight: 800, background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s', overflow: 'hidden', boxShadow: '0 8px 24px rgba(139,92,246,0.15)' }}>
                    {a.foto ? (
                      <img src={a.foto} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getInitials(a.nome)
                    )}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 20, boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                  </div>
                  
                  <div className="premium-card-content" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div className="premium-card-name" style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 6, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.nome}
                    </div>
                    <div className="premium-card-meta" style={{ fontSize: 14, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
                      {(() => {
                        const unidadeAluno = turmas.find(t => t.nome === a.turma || t.codigo === a.turma)?.unidade || (a as any).unidade
                        return (
                          <>
                            <span style={{ color: 'hsl(var(--primary))' }}>Turma {(a as any).turma}</span> {(a as any).serie ? `• ${(a as any).serie}` : ''} {unidadeAluno && unidadeAluno.trim() ? `• ${unidadeAluno}` : ''}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="premium-card-icons" style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                    <div className="premium-card-icon-btn" style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(99,102,241,0.08)', color: 'hsl(var(--primary))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid rgba(99,102,241,0.1)' }}>
                      <Bell size={20} />
                      <span className="badge-counter" style={{ position: 'absolute', top: -6, right: -6, background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', fontSize: 11, fontWeight: 900, width: 22, height: 22, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid hsl(var(--bg-surface))', boxShadow: '0 4px 12px rgba(225,29,72,0.4)', animation: 'pulseGlow 2s infinite' }}>
                        2
                      </span>
                    </div>
                    
                    {pendentes.length > 0 && (
                      <div className="premium-card-icon-btn" style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <AlertTriangle size={20} />
                      </div>
                    )}

                    <div className="premium-card-icon-btn chevron-icon" style={{ width: 48, height: 48, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                      <ChevronRight size={22} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
