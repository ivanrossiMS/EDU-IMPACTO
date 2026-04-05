'use client'

import { useData } from '@/lib/dataContext'
import { useParams } from 'next/navigation'
import { use, useMemo } from 'react'
import { GraduationCap, Download, ChevronRight, TrendingUp, TrendingDown, BookOpen } from 'lucide-react'
import { EmptyStateCard } from '../../components/EmptyStateCard'

export default function ADNotasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { alunos } = useData()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const aluno = alunos.find(a => a.id === resolvedParams.slug)

  // Mocked Disciplinas based on Student to give dynamic feel
  const disciplinas = useMemo(() => {
    // Generate some deterministic mock grades based on student ID to freeze random values
    const seed = aluno ? aluno.nome.length : 5
    return [
      { nome: 'Língua Portuguesa', media: 6 + (seed % 4), status: (6 + (seed % 4)) >= 7 ? 'Aprovado' : 'Recuperação' },
      { nome: 'Matemática', media: 5 + ((seed * 2) % 5), status: (5 + ((seed * 2) % 5)) >= 7 ? 'Aprovado' : 'Recuperação' },
      { nome: 'História', media: 7 + ((seed * 3) % 3), status: 'Aprovado' },
      { nome: 'Geografia', media: 8 + ((seed * 4) % 2), status: 'Aprovado' },
      { nome: 'Ciências', media: 6.5 + ((seed * 5) % 3.5), status: (6.5 + ((seed * 5) % 3.5)) >= 7 ? 'Aprovado' : 'Recuperação' },
    ].map(d => ({...d, media: parseFloat(d.media.toFixed(1))}))
  }, [aluno])

  const mediaGlobal = useMemo(() => {
     return parseFloat((disciplinas.reduce((acc, curr) => acc + curr.media, 0) / disciplinas.length).toFixed(1))
  }, [disciplinas])

  const isAcima = mediaGlobal >= 7.0

  if (!aluno) return null

  return (
    <div>
      <div className="ad-notas-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Boletim e Avaliações</h2>
        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={16} /> Baixar PDF
        </button>
      </div>

      <div className="ad-notas-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: 24, marginBottom: 32 }}>
        {/* Resumo Global */}
        <div className="card ad-notas-global-card" style={{ padding: 32, background: isAcima ? 'var(--gradient-primary)' : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
           <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(50px)' }} />
           <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
             <GraduationCap size={24} />
             <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 13, opacity: 0.9 }}>Média Global</div>
           </div>
           
           <div className="ad-notas-media-number" style={{ fontSize: 64, fontWeight: 800, fontFamily: 'Outfit, sans-serif', lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
             {mediaGlobal.toFixed(1)}
           </div>
           
           <div style={{ fontSize: 14, opacity: 0.9, marginTop: 12, fontWeight: 500 }}>
             Referente ao 1º Bimestre de 2026
           </div>

           <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
             {isAcima ? <TrendingUp size={20} color="#34d399"/> : <TrendingDown size={20} color="#fca5a5"/>}
             <span style={{ fontSize: 14, fontWeight: 600 }}>{isAcima ? 'Acima da média da turma' : 'Atenção necessária em 2 matérias'}</span>
           </div>
        </div>

        {/* Avaliações em Aberto */}
        <div className="card ad-notas-avalia-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div className="ad-notas-avalia-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
             <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Próximas Avaliações</h3>
             <button className="btn btn-ghost btn-sm" style={{ color: 'hsl(var(--primary))' }}>Ver Calendário</button>
          </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div className="ad-notas-ava-item" style={{ padding: 16, background: 'hsl(var(--bg-surface-alt))', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'center', border: '1px solid hsl(var(--border-subtle))' }}>
               <div className="ad-notas-ava-date" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                 <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Abr</span>
                 <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>25</span>
               </div>
               <div style={{ flex: 1 }}>
                 <div className="ad-notas-ava-title" style={{ fontWeight: 700, color: 'hsl(var(--text-main))', fontSize: 15 }}>Prova Bimestral</div>
                 <div className="ad-notas-ava-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={12}/> Matemática • Peso 2</div>
               </div>
               <div className="badge ad-notas-ava-badge" style={{ background: '#f59e0b', color: '#fff', border: 'none' }}>Em Breve</div>
             </div>
             
             <div className="ad-notas-ava-item" style={{ padding: 16, background: 'hsl(var(--bg-surface-alt))', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'center', border: '1px solid hsl(var(--border-subtle))' }}>
               <div className="ad-notas-ava-date" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                 <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Mai</span>
                 <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>02</span>
               </div>
               <div style={{ flex: 1 }}>
                 <div className="ad-notas-ava-title" style={{ fontWeight: 700, color: 'hsl(var(--text-main))', fontSize: 15 }}>Trabalho em Grupo</div>
                 <div className="ad-notas-ava-desc" style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={12}/> Ciências • Peso 1</div>
               </div>
               <div className="badge badge-neutral ad-notas-ava-badge">Agendado</div>
             </div>
          </div>
        </div>
      </div>

      <div className="card ad-notas-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ad-notas-table-title" style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface-alt))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Rendimento por Disciplina</h3>
          <select className="form-input" style={{ width: 'auto', padding: '4px 12px', fontSize: 13, borderRadius: 20 }}>
            <option>1º Bimestre</option>
            <option>2º Bimestre</option>
          </select>
        </div>
        
        <div className="ad-notas-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="ad-notas-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
            <tr style={{ background: 'hsl(var(--bg-surface))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <th className="ad-notas-th" style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>Disciplina</th>
              <th className="ad-notas-th" style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1 }}>Progresso / Desempenho</th>
              <th className="ad-notas-th" style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, width: '120px' }}>Média Final</th>
              <th className="ad-notas-th" style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Análise</th>
            </tr>
          </thead>
          <tbody>
            {disciplinas.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='hsl(var(--bg-surface-alt))'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <td className="ad-notas-td ad-notas-td-title" style={{ padding: '20px 24px', fontWeight: 700, color: 'hsl(var(--text-main))', fontSize: 15 }}>{d.nome}</td>
                <td className="ad-notas-td" style={{ padding: '20px 24px' }}>
                  <div className="ad-notas-prog-box" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ height: '100%', background: d.media >= 7 ? '#10b981' : '#ef4444', width: `${d.media * 10}%`, borderRadius: 4 }}></div>
                    </div>
                    <span className="ad-notas-status" style={{ fontSize: 13, fontWeight: 600, color: d.media >= 7 ? '#10b981' : '#ef4444', width: 80 }}>
                      {d.status}
                    </span>
                  </div>
                </td>
                <td className="ad-notas-td" style={{ padding: '20px 24px' }}>
                  <div className="ad-notas-td-grade" style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: d.media >= 7 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: d.media >= 7 ? '#059669' : '#dc2626',
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 18,
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    {d.media.toFixed(1)}
                  </div>
                </td>
                <td className="ad-notas-td" style={{ padding: '20px 24px', textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '8px 12px', borderRadius: 8, color: 'hsl(var(--primary))' }}>
                    Avaliações <ChevronRight size={16} style={{ marginLeft: 4 }}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
