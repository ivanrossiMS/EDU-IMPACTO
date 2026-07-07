'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FolderArchive, Search, Plus, Loader2, Download, Trash2, GraduationCap, ChevronRight, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ArquivoAdaptadasPage() {
  const { currentUserPerfil } = useApp()
  const router = useRouter()
  
  const [arquivos, setArquivos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAno, setFilterAno] = useState(new Date().getFullYear().toString())
  const [filterTurma, setFilterTurma] = useState('')
  
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<string[]>([])
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([new Date().getFullYear().toString()])
  const [expandedTurmas, setExpandedTurmas] = useState<Record<string, boolean>>({})

  const formatBytes = (bytes: number) => {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  useEffect(() => {
    if (currentUserPerfil === 'professor') {
      router.push('/simulados')
    }
  }, [currentUserPerfil, router])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filterAno) params.append('filterAno', filterAno)
        if (filterTurma) params.append('filterTurma', filterTurma)
        if (search) params.append('search', search)

        const res = await fetch(`/api/arquivos-adaptadas?${params.toString()}`)
        const json = await res.json()

        if (!res.ok) {
          console.error(json.error)
          setArquivos([])
        } else {
          let data = json.data || []
          
          try {
            const { data: bimestresData } = await supabase.from('simulados_bimestres').select('id, nome')
            if (bimestresData) {
              const bimestresMap = new Map()
              bimestresData.forEach(b => bimestresMap.set(b.id, b.nome))
              data = data.map((item: any) => ({
                ...item,
                bimestre: bimestresMap.get(item.bimestre) || item.bimestre
              }))
            }
          } catch (e) {
            console.error('Erro ao mapear bimestres:', e)
          }

          setArquivos(data)
          
          const anos = new Set<string>()
          const turmas = new Set<string>()
          data?.forEach((item: any) => {
            if (item.ano_letivo) anos.add(item.ano_letivo)
            if (item.turma) turmas.add(item.turma)
          })
          if (anos.size > 0) setAnosDisponiveis(Array.from(anos).sort().reverse())
          if (turmas.size > 0) setTurmasDisponiveis(Array.from(turmas).sort())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    const timeout = setTimeout(() => {
      loadData()
    }, 300)
    
    return () => clearTimeout(timeout)
  }, [filterAno, filterTurma, search])

  const handleDelete = async (id: string, url: string) => {
    if (!confirm('Deseja realmente excluir este arquivo?')) return
    try {
      const { error } = await supabase.from('arquivos_adaptadas').delete().eq('id', id)
      if (error) throw error
      
      setArquivos(prev => prev.filter(a => a.id !== id))
      toast.success('Arquivo excluído com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message)
    }
  }

  if (currentUserPerfil === 'professor') return null

  const groupedByTurma = arquivos.reduce((acc, curr) => {
    const turma = curr.turma || 'Sem Turma'
    const alunoId = curr.alunos.id
    if (!acc[turma]) {
      acc[turma] = {}
    }
    if (!acc[turma][alunoId]) {
      acc[turma][alunoId] = {
        aluno_nome: curr.alunos.nome,
        arquivos: []
      }
    }
    acc[turma][alunoId].arquivos.push(curr)
    return acc
  }, {} as Record<string, Record<string, { aluno_nome: string, arquivos: any[] }>>)

  const toggleTurma = (turma: string) => {
    setExpandedTurmas(prev => ({ ...prev, [turma]: !prev[turma] }))
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderArchive size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>Arquivo Adaptadas</h1>
            <p style={{ margin: '4px 0 0 0', color: 'hsl(var(--text-secondary))', fontSize: 14 }}>
              Gerencie e visualize provas digitalizadas e adaptadas dos alunos.
            </p>
          </div>
        </div>

        <Link href="/simulados/arquivo-adaptadas/nova">
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Plus size={18} /> Nova Digitalização
          </motion.button>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-tertiary))' }} />
          <input 
            type="text" 
            placeholder="Buscar por nome do aluno..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ 
              width: '100%', padding: '12px 16px 12px 40px', borderRadius: 12, 
              border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))',
              color: 'hsl(var(--text-primary))', fontSize: 14, outline: 'none'
            }} 
          />
        </div>
        
        <select 
          value={filterAno} 
          onChange={e => setFilterAno(e.target.value)}
          style={{ 
            padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', 
            background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', fontSize: 14, minWidth: 150, outline: 'none'
          }}
        >
          <option value="">Todos os Anos</option>
          {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
        </select>

        <select 
          value={filterTurma} 
          onChange={e => setFilterTurma(e.target.value)}
          style={{ 
            padding: '12px 16px', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', 
            background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', fontSize: 14, minWidth: 150, outline: 'none'
          }}
        >
          <option value="">Todas as Turmas</option>
          {turmasDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
          <p>Carregando arquivos...</p>
        </div>
      ) : Object.keys(groupedByTurma).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-secondary))', border: '2px dashed hsl(var(--border-subtle))', borderRadius: 24 }}>
          <FolderArchive size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'hsl(var(--text-primary))' }}>Nenhum arquivo encontrado</h3>
          <p style={{ margin: 0, fontSize: 14 }}>Tente ajustar os filtros ou faça uma nova digitalização.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {Object.entries(groupedByTurma).map(([turma, alunosObj]) => {
            const isExpanded = expandedTurmas[turma]
            const qtdAlunos = Object.keys(alunosObj as any).length
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                key={turma} 
                style={{ 
                  background: 'hsl(var(--bg-surface))', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', 
                  overflow: 'hidden'
                }}
              >
                <div 
                  onClick={() => toggleTurma(turma)}
                  style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{turma}</h3>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span>{qtdAlunos} aluno{qtdAlunos > 1 ? 's' : ''} com arquivos</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} style={{ color: 'hsl(var(--text-secondary))', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
                
                {isExpanded && (
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(alunosObj as any).map(([alunoId, group]: [string, any]) => (
                      <div key={alunoId} style={{ background: 'hsl(var(--bg-body))', borderRadius: 12, padding: 16, border: '1px solid hsl(var(--border-subtle))' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }}></div>
                          {group.aluno_nome}
                        </h4>
                        
                        {(() => {
                          const byBimestre = group.arquivos.reduce((acc: any, curr: any) => {
                            const bim = curr.bimestre || 'Outros'
                            if (!acc[bim]) acc[bim] = []
                            acc[bim].push(curr)
                            return acc
                          }, {})

                          const sortedBimestres = Object.keys(byBimestre).sort((a, b) => {
                            if (a === 'Outros') return 1
                            if (b === 'Outros') return -1
                            return a.localeCompare(b)
                          })

                          return sortedBimestres.map(bim => (
                            <div key={bim} style={{ marginBottom: bim === sortedBimestres[sortedBimestres.length - 1] ? 0 : 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ 
                                  fontSize: 11, fontWeight: 700, 
                                  color: bim === 'Outros' ? 'hsl(var(--text-secondary))' : '#3b82f6', 
                                  textTransform: 'uppercase', letterSpacing: 0.5, 
                                  background: bim === 'Outros' ? 'hsl(var(--bg-elevated))' : 'rgba(59, 130, 246, 0.1)', 
                                  border: `1px solid ${bim === 'Outros' ? 'hsl(var(--border-subtle))' : 'rgba(59, 130, 246, 0.2)'}`, 
                                  padding: '4px 12px', borderRadius: 20,
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                  display: 'inline-flex', alignItems: 'center'
                                }}>
                                  {bim}
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {byBimestre[bim].map((arq: any) => (
                                  <div key={arq.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FileText size={16} />
                                      </div>
                                      <div style={{ overflow: 'hidden' }}>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={arq.titulo}>{arq.titulo}</p>
                                        <p style={{ margin: 0, fontSize: 11, color: 'hsl(var(--text-tertiary))', display: 'flex', gap: 4, alignItems: 'center' }}>
                                          {new Date(arq.created_at).toLocaleDateString('pt-BR')}
                                          {arq.tamanho_bytes ? <span>• {formatBytes(arq.tamanho_bytes)}</span> : null}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <a 
                                        href={arq.file_url} target="_blank" rel="noopener noreferrer"
                                        style={{ width: 32, height: 32, borderRadius: 8, background: 'hsl(var(--bg-elevated))', color: '#3b82f6', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                        title="Visualizar/Baixar"
                                      >
                                        <Download size={14} />
                                      </a>
                                      <button 
                                        onClick={() => handleDelete(arq.id, arq.file_url)}
                                        style={{ width: 32, height: 32, borderRadius: 8, background: 'hsl(var(--bg-elevated))', color: '#ef4444', border: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                        title="Excluir"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
