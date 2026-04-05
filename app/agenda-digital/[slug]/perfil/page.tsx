'use client'

import { useData } from '@/lib/dataContext'
import { useParams } from 'next/navigation'
import { use } from 'react'
import { UserCog, Camera, Phone, Mail, ShieldAlert, GraduationCap, MapPin, Edit3 } from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'

export default function ADPerfilPage({ params }: { params: Promise<{ slug: string }>}) {
  const { alunos } = useData()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const aluno = alunos.find(a => a.id === resolvedParams.slug)

  if (!aluno) return null

  const responsaveisList = (aluno as any).responsaveis || (aluno as any)._responsaveis || [
    { nome: aluno.responsavel || 'Contato Principal', parentesco: 'Responsável', telefone: aluno.telefone, email: aluno.email, tipo: 'Ambos' }
  ]
  const saude = (aluno as any).saude || {}

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>


      <div className="ad-perfil-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 24 }}>
        {/* Contatos de Emergência */}
        <div className="card ad-perfil-card" style={{ padding: 24 }}>
          <div className="ad-perfil-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <ShieldAlert size={20} color="#f59e0b" />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Protocolo / Contatos</h3>
          </div>
          
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>
            Seus contatos de emergência e responsáveis autorizados a retirar o aluno na escola.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             {responsaveisList.map((resp: any, i: number) => {
                const nameMatch = resp.nome ? resp.nome.toLowerCase() : '';
                const isFin = resp.respFinanceiro || resp.financeiro || resp.tipo === 'Financeiro' || resp.tipo === 'Ambos' || (aluno.responsavelFinanceiro && aluno.responsavelFinanceiro.toLowerCase().includes(nameMatch));
                const isPed = resp.respPedagogico || resp.pedagogico || resp.tipo === 'Pedagógico' || resp.tipo === 'Ambos' || (aluno.responsavelPedagogico && aluno.responsavelPedagogico.toLowerCase().includes(nameMatch));
                const parentesco = resp.parentesco || resp.vinculo || (typeof resp.tipo === 'string' && ['mae', 'mãe', 'pai', 'avó', 'avô', 'tia', 'tio'].includes(resp.tipo.toLowerCase()) ? resp.tipo : null) || 'Responsável';

                return (
                <div key={i} className="ad-perfil-resp-card" style={{ padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="ad-perfil-resp-info">
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-main))', textTransform: 'capitalize' }}>{resp.nome}</div>
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <span style={{ textTransform: 'capitalize' }}>{parentesco}</span>
                      {resp.telefone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12}/> {resp.telefone}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                     {isFin && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>FINANCEIRO</span>}
                     {isPed && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>PEDAGÓGICO</span>}
                     {!isFin && !isPed && <span className="badge badge-neutral" style={{ fontSize: 10 }}>AUTORIZADO</span>}
                  </div>
                </div>
                )
             })}
          </div>

          <div style={{ marginTop: 24, padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCog size={16} color="hsl(var(--text-muted))" /> Liberação e Saída
            </h4>
            
            <div style={{ marginBottom: 16 }}>
              {saude.autorizaSaida === false ? (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={14} /> NÃO pode sair sozinho (Requer acompanhante autorizado)
                </div>
              ) : saude.autorizaSaida === true ? (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>✅</span> Autorizado a sair sozinho
                </div>
              ) : (
                <div style={{ padding: 10, borderRadius: 8, background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))', fontSize: 13, fontWeight: 600 }}>
                   Status de saída independente não informado
                </div>
              )}
            </div>

            {saude.autorizados && saude.autorizados.length > 0 ? (
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>Autorizados a retirar</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {saude.autorizados.map((aut: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'hsl(var(--bg-base))', borderRadius: 8, border: '1px solid hsl(var(--border-subtle))' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{aut.nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{aut.parentesco}</div>
                      </div>
                      {aut.telefone && <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12}/> {aut.telefone}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Nenhum terceiro cadastrado. Apenas responsáveis principais.
              </div>
            )}
          </div>
        </div>

        {/* Ficha Médica e Dados */}
        <div className="card ad-perfil-card" style={{ padding: 24 }}>
          <div className="ad-perfil-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <UserCog size={20} color="hsl(var(--primary))" />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Ficha do Aluno</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div>
               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Data de Nascimento</div>
               <div style={{ fontSize: 15, fontWeight: 600 }}>{aluno.dataNascimento ? formatDate(aluno.dataNascimento) : '—'}</div>
             </div>
             <div>
               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>CPF</div>
               <div style={{ fontSize: 15, fontWeight: 600 }}>{aluno.cpf}</div>
             </div>
             
             <div style={{ padding: 16, background: saude.alergias ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', border: `1px solid ${saude.alergias ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`, borderRadius: 12, marginTop: 8 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: saude.alergias ? '#ef4444' : '#10b981', marginBottom: 4 }}>Restrições Médicas / Alergias</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: saude.alergias ? '#b91c1c' : '#047857' }}>{saude.alergias || 'Nenhuma restrição reportada na matrícula.'}</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
