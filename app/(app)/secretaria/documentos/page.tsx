'use client'

import { useData } from '@/lib/dataContext'
import { useState } from 'react'
import { FileText, Search, Plus, FileCheck, Download } from 'lucide-react'

export default function SecretariaPage() {
  const { alunos } = useData()
  const [search, setSearch] = useState('')
  const [alunoSel, setAlunoSel] = useState('')

  const filtered = alunos.filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.matricula.includes(search)
  )

  const DOCUMENTOS_TIPOS = [
    { icon: '📋', label: 'Declaração de Matrícula', desc: 'Comprova matrícula do aluno no período indicado' },
    { icon: '📅', label: 'Declaração de Frequência', desc: 'Comprova frequência escolar para fins externos' },
    { icon: '📚', label: 'Histórico Escolar', desc: 'Histórico completo de notas e progressão' },
    { icon: '✅', label: 'Atestado de Escolaridade', desc: 'Comprova nível de escolaridade atual' },
    { icon: '📊', label: 'Boletim Escolar', desc: 'Notas e frequência por bimestre' },
    { icon: '🔄', label: 'Declaração de Transferência', desc: 'Para transferências entre escolas' },
  ]

  const alunoSelecionado = alunos.find(a => a.id === alunoSel)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Secretaria Digital</h1>
          <p className="page-subtitle">Documentos, declarações, atestados e protocolos</p>
        </div>
        <button className="btn btn-primary btn-sm"><Plus size={13} />Novo Protocolo</button>
      </div>

      {/* Seleção de aluno */}
      <div className="card" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Selecionar Aluno para Emitir Documento</div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input className="form-input" style={{ paddingLeft: 36 }}
            placeholder="Buscar aluno por nome ou matrícula..."
            value={search}
            onChange={e => { setSearch(e.target.value); setAlunoSel('') }}
          />
        </div>
        {search && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: 8 }}>
            {filtered.slice(0, 10).map(a => (
              <button key={a.id} onClick={() => { setAlunoSel(a.id); setSearch(a.nome) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: alunoSel === a.id ? 'rgba(59,130,246,0.1)' : 'transparent', border: 'none', textAlign: 'left', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Cód.: {a.matricula} • Turma: {a.turma} • {a.serie}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {alunoSelecionado && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: '#60a5fa' }}>✓ Aluno selecionado:</span>{' '}
            {alunoSelecionado.nome} — Cód. {(alunoSelecionado as any).codigo || alunoSelecionado.matricula} • {alunoSelecionado.turma} • {alunoSelecionado.status}
          </div>
        )}
      </div>

      {/* Tipos de documentos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {DOCUMENTOS_TIPOS.map(doc => (
          <div key={doc.label} className="card" style={{ padding: '20px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {doc.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{doc.label}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 10 }}>{doc.desc}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {alunoSelecionado ? (
                    <span style={{ fontSize: 11, color: '#34d399' }}>Pronto para emitir</span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Selecione um aluno</span>
                  )}
                  <button className={`btn btn-sm ${alunoSelecionado ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 11 }}
                    disabled={!alunoSelecionado}>
                    <Download size={11} />Emitir PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alunos cadastrados */}
      {alunos.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nenhum aluno cadastrado</div>
          <div style={{ fontSize: 13 }}>Cadastre alunos no módulo Acadêmico para emitir documentos.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Alunos Elegíveis — {alunos.length} cadastrados</div>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr><th>Aluno</th><th>Matrícula</th><th>Turma</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {alunos.slice(0, 20).map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                          {a.nome.split(' ')[0][0]}{a.nome.split(' ')[1]?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{a.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.responsavel}</div>
                        </div>
                      </div>
                    </td>
                    <td><code style={{ fontSize: 12, background: 'hsl(var(--bg-overlay))', padding: '2px 6px', borderRadius: 4 }}>{a.matricula}</code></td>
                    <td><span className="badge badge-neutral">{a.turma}</span></td>
                    <td>
                      <span className={`badge ${a.status === 'matriculado' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>{a.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                          <FileCheck size={11} />Emitir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
