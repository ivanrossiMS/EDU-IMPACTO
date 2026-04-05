'use client'

import { useApp } from '@/lib/context'
import { UserCog, Phone, Mail, ShieldAlert, Award, Briefcase, MapPin } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export default function ColaboradorPerfilPage() {
  const { currentUser } = useApp()

  if (!currentUser) return null

  // Dados mockados para exibição
  const unidade = "Sede Principal"
  const setor = currentUser.cargo === 'Professor' || currentUser.perfil === 'Professor' ? 'Corpo Docente' : 'Administração'
  const telefoneStr = "(11) 99999-0000"
  const docIdentificador = "123.456.789-00"

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      <div className="ad-perfil-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 24 }}>
        
        {/* Ficha Institucional */}
        <div className="card ad-perfil-card" style={{ padding: 24 }}>
          <div className="ad-perfil-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Award size={20} color="#3b82f6" />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Vínculo Institucional</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div>
               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Nome Registrado</div>
               <div style={{ fontSize: 15, fontWeight: 600 }}>{currentUser.nome}</div>
             </div>
             <div>
               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Matrícula / Documento</div>
               <div style={{ fontSize: 15, fontWeight: 600 }}>{docIdentificador}</div>
             </div>
             <div>
               <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 4 }}>Unidade de Lotação</div>
               <div style={{ fontSize: 15, fontWeight: 600 }}>{unidade}</div>
             </div>
             
             <div style={{ padding: 16, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 12, marginTop: 8 }}>
                <div style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: '#3b82f6', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                   <Briefcase size={14} /> Cargo e Setor
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1e40af' }}>
                   {currentUser.cargo || currentUser.perfil} • {setor}
                </div>
             </div>
          </div>
        </div>

        {/* Contatos do Usuário */}
        <div className="card ad-perfil-card" style={{ padding: 24 }}>
          <div className="ad-perfil-card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <UserCog size={20} color="#8b5cf6" />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Meus Dados</h3>
          </div>
          
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>
            E-mail e telefone utilizados para contato interno na plataforma.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             <div className="ad-perfil-resp-card" style={{ padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div className="ad-perfil-resp-info">
                 <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-main))', textTransform: 'capitalize' }}>Email Principal</div>
                 <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                   <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12}/> {currentUser.email || 'Nenhum e-mail vinculado'}</span>
                 </div>
               </div>
             </div>

             <div className="ad-perfil-resp-card" style={{ padding: 16, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div className="ad-perfil-resp-info">
                 <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-main))', textTransform: 'capitalize' }}>Celular Corporativo</div>
                 <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                   <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12}/> {telefoneStr}</span>
                 </div>
               </div>
             </div>
          </div>

          <div style={{ marginTop: 24, padding: 16, borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#d97706' }}>
              <ShieldAlert size={16} color="#d97706" /> Atualização de Dados
            </h4>
            <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
               Para atualizar seu e-mail corporativo ou alterar o telefone profissional, acesse a guia de <strong>Configurações do ERP</strong> pelo computador ou contate o administrador do sistema EDU-IMPACTO.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
