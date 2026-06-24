'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Search, Lock, UserCheck, AlertTriangle, Save } from 'lucide-react'

export default function PermissoesSimuladosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [roles, setRoles] = useState([
    { id: 1, nome: 'Administrador Escolar', desc: 'Acesso total ao módulo (criação, edição e exclusão de qualquer dado).', cor: '#ef4444' },
    { id: 2, nome: 'Coordenador Pedagógico', desc: 'Pode gerenciar simulados, bimestres e ver relatórios. Não exclui professores.', cor: '#3b82f6' },
    { id: 3, nome: 'Professor', desc: 'Pode cadastrar questões no banco e ver suas próprias requisições de simulados.', cor: '#10b981' }
  ])

  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({
    'Administrador Escolar': { view_dashboard: true, gerenciar_banco: true, gerenciar_provas: true, imprimir_provas: true, configuracoes: true },
    'Coordenador Pedagógico': { view_dashboard: true, gerenciar_banco: true, gerenciar_provas: true, imprimir_provas: true, configuracoes: false },
    'Professor': { view_dashboard: true, gerenciar_banco: true, gerenciar_provas: false, imprimir_provas: false, configuracoes: false },
  })

  const togglePermission = (roleName: string, perm: string) => {
    setPermissions(prev => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [perm]: !prev[roleName][perm]
      }
    }))
  }

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      alert('Permissões salvas com sucesso!')
    }, 800)
  }

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
              <Shield size={24} color="#f43f5e" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Permissões de Acesso</h1>
              <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Configure o que cada perfil pode fazer no módulo de Simulados</p>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? <span style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '16px 20px', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 32 }}>
          <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ color: '#d97706', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Atenção com as Permissões Administrativas</div>
            <div style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, lineHeight: 1.5 }}>
              Alterar o acesso ao "Banco de Questões" afeta quem pode ver e alterar questões globais. Professores devem ter acesso apenas às suas próprias questões e turmas (regra de linha, aplicada automaticamente).
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
          {roles.map(role => (
            <div key={role.id} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${role.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={20} color={role.cor} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{role.nome}</h3>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Perfil do sistema</div>
                </div>
              </div>
              
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.5, marginBottom: 8 }}>
                  {role.desc}
                </div>
                
                {[
                  { key: 'view_dashboard', label: 'Ver Dashboard', icon: <Search size={16} /> },
                  { key: 'gerenciar_banco', label: 'Banco de Questões', icon: <Lock size={16} /> },
                  { key: 'gerenciar_provas', label: 'Criar Provas/Simulados', icon: <Lock size={16} /> },
                  { key: 'imprimir_provas', label: 'Imprimir Cadernos', icon: <Lock size={16} /> },
                  { key: 'configuracoes', label: 'Configurações e Cadastros globais', icon: <Lock size={16} /> }
                ].map(perm => (
                  <label key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'hsl(var(--text-primary))', fontSize: 14, fontWeight: 500 }}>
                      <div style={{ color: 'hsl(var(--text-muted))' }}>{perm.icon}</div>
                      {perm.label}
                    </div>
                    <div style={{ width: 44, height: 24, borderRadius: 12, background: permissions[role.nome]?.[perm.key] ? '#10b981' : 'hsl(var(--border-subtle))', position: 'relative', transition: 'background 0.2s' }}>
                      <input 
                        type="checkbox" 
                        checked={permissions[role.nome]?.[perm.key] || false}
                        onChange={() => togglePermission(role.nome, perm.key)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <div style={{ position: 'absolute', top: 2, left: permissions[role.nome]?.[perm.key] ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

      </motion.div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  )
}
