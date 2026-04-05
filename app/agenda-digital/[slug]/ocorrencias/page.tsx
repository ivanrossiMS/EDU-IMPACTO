'use client'

import React, { useState, use } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle2, Shield, Heart } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { useData } from '@/lib/dataContext'

interface Ocorrencia {
  id: string
  titulo: string
  descricao: string
  tipo: 'elogio' | 'alerta' | 'advertencia'
  data: string
  autor: string
  assinado: boolean
}

export default function ADOcorrenciasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { alunos } = useData()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const aluno = alunos.find(a => a.id === resolvedParams.slug)

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([
    {
      id: 'oc1',
      titulo: 'Elogio por proatividade nas atividades',
      descricao: aluno?.obs || 'O aluno demonstrou excelente espírito de equipe durante o projeto de artes, ajudando os colegas a concluírem suas maquetes.',
      tipo: 'elogio',
      data: new Date().toISOString(),
      autor: 'Prof. Marina (Artes)',
      assinado: true,
    },
    {
      id: 'oc2',
      titulo: 'Falta de material na aula de geometria',
      descricao: 'Favor verificar o envio do kit de geometria na próxima aula, conforme solicitado em lista de materiais.',
      tipo: 'alerta',
      data: new Date(Date.now() - 86400000 * 2).toISOString(),
      autor: 'Prof. Carlos (Matemática)',
      assinado: false,
    }
  ])

  const handleAssinar = (id: string) => {
    setOcorrencias(prev => prev.map(o => o.id === id ? { ...o, assinado: true } : o))
  }

  return (
    <div>
      <div className="ad-ocorrencias-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Histórico Comportamental</h2>
      </div>

      {ocorrencias.length === 0 ? (
        <EmptyStateCard 
          title="Sem Ocorrências"
          description="Você ainda não possui nenhum registro disciplinar ou pedagógico."
          icon={<Shield size={48} style={{ opacity: 0.2 }} />}
        />
      ) : (
        <div className="ad-oco-list" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
           {ocorrencias.map(o => {
             const isElogio = o.tipo === 'elogio'
             const IconBase = isElogio ? Heart : (o.tipo === 'advertencia' ? AlertTriangle : AlertCircle)
             const colorHex = isElogio ? '#10b981' : (o.tipo === 'advertencia' ? '#ef4444' : '#f59e0b')

             return (
               <div key={o.id} className="card ad-oco-card" style={{ padding: 24, display: 'flex', gap: 20, borderLeft: `4px solid ${colorHex}` }}>
                 <div className="ad-oco-icon" style={{ 
                   width: 48, height: 48, borderRadius: 24, 
                   background: `${colorHex}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                 }}>
                   <IconBase size={24} color={colorHex} />
                 </div>
                 
                 <div style={{ flex: 1 }}>
                   <div className="ad-oco-title-box" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                     <h3 className="ad-oco-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{o.titulo}</h3>
                     <span className="ad-oco-date" style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                       {new Date(o.data).toLocaleDateString('pt-BR')}
                     </span>
                   </div>
                   
                   <p className="ad-oco-desc" style={{ fontSize: 15, color: 'hsl(var(--text-main))', marginBottom: 12 }}>{o.descricao}</p>
                   
                   <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginBottom: o.assinado ? 0 : 16 }}>
                     Registrado por <strong>{o.autor}</strong>
                   </div>

                   {!o.assinado && !isElogio && (
                     <div className="ad-oco-assinatura-box" style={{ 
                        background: 'rgba(245,158,11,0.05)', 
                        padding: '12px 16px', 
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid rgba(245,158,11,0.2)'
                      }}>
                        <div className="ad-oco-assinatura-text" style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>
                          Este registro requer sua assinatura digital obrigatória.
                        </div>
                        <button onClick={() => handleAssinar(o.id)} className="btn btn-primary btn-sm ad-oco-assinatura-btn">Estou Ciente</button>
                      </div>
                   )}
                   {o.assinado && !isElogio && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981', fontWeight: 600, marginTop: 12 }}>
                        <CheckCircle2 size={16} /> Ciente
                      </div>
                   )}
                 </div>
               </div>
             )
           })}
        </div>
      )}
    </div>
  )
}
