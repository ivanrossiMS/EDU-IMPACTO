'use client'

import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, Edit2, Check, X } from 'lucide-react'

export function AdminWhatsAppContactsManager({ localConfig, setLocalConfig }: any) {
  const contatos = localConfig.contatosWhatsapp || []
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ id: '', nome: '', telefone: '', descricao: '', ativo: true, ordem: 0 })

  const handleAdd = () => {
    const newId = Date.now().toString()
    setLocalConfig((p: any) => ({
      ...p,
      contatosWhatsapp: [
        ...(p.contatosWhatsapp || []),
        { id: newId, nome: 'Novo Contato', telefone: '', descricao: '', ativo: true, ordem: (p.contatosWhatsapp?.length || 0) }
      ]
    }))
    setIsEditing(newId)
    setEditForm({ id: newId, nome: 'Novo Contato', telefone: '', descricao: '', ativo: true, ordem: (contatos.length || 0) })
  }

  const handleSave = () => {
    setLocalConfig((p: any) => ({
      ...p,
      contatosWhatsapp: p.contatosWhatsapp.map((c: any) => c.id === editForm.id ? editForm : c)
    }))
    setIsEditing(null)
  }

  const handleDelete = (id: string) => {
    setLocalConfig((p: any) => ({
      ...p,
      contatosWhatsapp: p.contatosWhatsapp.filter((c: any) => c.id !== id)
    }))
  }

  const handleToggle = (id: string, currentStatus: boolean) => {
    setLocalConfig((p: any) => ({
      ...p,
      contatosWhatsapp: p.contatosWhatsapp.map((c: any) => c.id === id ? { ...c, ativo: !currentStatus } : c)
    }))
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === contatos.length - 1)) return
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newArray = [...contatos]
    const temp = newArray[index]
    newArray[index] = newArray[newIndex]
    newArray[newIndex] = temp

    // Update ordem property based on array position
    const reordered = newArray.map((c, i) => ({ ...c, ordem: i }))
    
    setLocalConfig((p: any) => ({
      ...p,
      contatosWhatsapp: reordered
    }))
  }

  return (
    <div>
      <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Contatos Rápidos do WhatsApp</h3>
          <p style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 14 }}>Configure os atalhos de contato que aparecerão no botão flutuante da Agenda Digital.</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Novo Contato
        </button>
      </div>

      <div style={{ padding: 32 }}>
        {contatos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px dashed hsl(var(--border-subtle))' }}>
            <p style={{ color: 'hsl(var(--text-muted))', marginBottom: 16 }}>Nenhum contato cadastrado.</p>
            <button className="btn btn-primary" onClick={handleAdd} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={16} /> Criar Primeiro Contato
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {contatos.map((contato: any, index: number) => (
              <div key={contato.id} style={{ display: 'flex', border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', background: '#f8fafc', borderRight: '1px solid hsl(var(--border-subtle))', justifyContent: 'center', gap: 8 }}>
                  <button onClick={() => moveItem(index, 'up')} disabled={index === 0} style={{ border: 'none', background: 'transparent', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </button>
                  <button onClick={() => moveItem(index, 'down')} disabled={index === contatos.length - 1} style={{ border: 'none', background: 'transparent', cursor: index === contatos.length - 1 ? 'not-allowed' : 'pointer', opacity: index === contatos.length - 1 ? 0.3 : 1 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                </div>

                <div style={{ flex: 1, padding: 20 }}>
                  {isEditing === contato.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 600, color: '#4b5563' }}>Setor / Nome</label>
                          <input type="text" className="form-input" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="Ex: Secretaria" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 600, color: '#4b5563' }}>Telefone (WhatsApp)</label>
                          <input type="text" className="form-input" value={editForm.telefone} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="(11) 99999-9999" />
                        </div>
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 12, marginBottom: 4, display: 'block', fontWeight: 600, color: '#4b5563' }}>Descrição (Opcional)</label>
                        <input type="text" className="form-input" value={editForm.descricao} onChange={e => setEditForm({ ...editForm, descricao: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="Para dúvidas gerais e matrículas" />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button onClick={() => setIsEditing(null)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                          <X size={14} /> Cancelar
                        </button>
                        <button onClick={handleSave} style={{ padding: '6px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                          <Check size={14} /> Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{contato.nome}</h4>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: contato.ativo ? '#dcfce7' : '#f1f5f9', color: contato.ativo ? '#166534' : '#64748b', fontWeight: 500 }}>
                            {contato.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: '#4b5563', marginBottom: 2 }}>{contato.telefone || 'Sem telefone'}</div>
                        {contato.descricao && <div style={{ fontSize: 13, color: '#6b7280' }}>{contato.descricao}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                          <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={contato.ativo} onChange={() => handleToggle(contato.id, contato.ativo)} />
                          <span style={{ position: 'absolute', inset: 0, background: contato.ativo ? '#10b981' : 'hsl(var(--border-subtle))', borderRadius: 24, transition: '.4s' }}>
                             <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.4s', borderRadius: '50%', transform: contato.ativo ? 'translateX(20px)' : 'none' }}></span>
                          </span>
                        </label>
                        <div style={{ width: 1, height: 24, background: 'hsl(var(--border-subtle))' }}></div>
                        <button onClick={() => { setIsEditing(contato.id); setEditForm(contato) }} style={{ border: 'none', background: 'transparent', color: '#6366f1', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex' }} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(contato.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex' }} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
