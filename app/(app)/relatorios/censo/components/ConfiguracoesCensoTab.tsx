'use client'
import { useState } from 'react'
import { useData } from '@/lib/dataContext'
import { Save, Settings, Map, Database } from 'lucide-react'

const MAPEAMENTOS = [
  { campo:'Nome do Aluno',       origem:'alunos.nome',           destino:'Registro 20 - Posição 17-96',  obrigatorio:true,  status:'ok' },
  { campo:'Data de Nascimento',  origem:'alunos.dataNascimento', destino:'Registro 20 - Posição 97-104', obrigatorio:true,  status:'ok' },
  { campo:'Sexo',                origem:'alunos.sexo',           destino:'Registro 20 - Posição 105',    obrigatorio:true,  status:'alerta', obs:'Campo sexo pode não estar preenchido no ERP' },
  { campo:'CPF',                 origem:'alunos.cpf',            destino:'Registro 20 - Posição 106-116',obrigatorio:false, status:'ok' },
  { campo:'Turma',               origem:'alunos.turma',          destino:'Registro 20 - Posição 117-121',obrigatorio:true,  status:'ok' },
  { campo:'Código Interna',   origem:'alunos.matricula',      destino:'Registro 20 - Posição 09-28',  obrigatorio:false, status:'ok' },
  { campo:'Nome da Turma',       origem:'turmas.nome',           destino:'Registro 10 - Posição 17-66',  obrigatorio:true,  status:'ok' },
  { campo:'Turno',               origem:'turmas.turno',          destino:'Registro 10 - Posição 67',     obrigatorio:true,  status:'ok' },
  { campo:'Série',               origem:'turmas.serie',          destino:'Registro 10 - Posição 68-87',  obrigatorio:true,  status:'ok' },
  { campo:'INEP Escola',         origem:'unidades.inep',         destino:'Registro 00 - Posição 07-14',  obrigatorio:true,  status:'alerta', obs:'Verifique se o código INEP está preenchido em Configurações' },
  { campo:'CNPJ Escola',         origem:'unidades.cnpj',         destino:'Registro 00 - Posição 15-28',  obrigatorio:true,  status:'ok' },
  { campo:'Gestor Escolar',      origem:'unidades.diretor.nome', destino:'Registro 00 - Posição 109-188',obrigatorio:true,  status:'ok' },
  { campo:'Nome Profissional',   origem:'funcionarios.nome',     destino:'Registro 40 - Posição 17-96',  obrigatorio:true,  status:'ok' },
  { campo:'Cargo Profissional',  origem:'funcionarios.cargo',    destino:'Registro 40 - Posição 97-126', obrigatorio:true,  status:'ok' },
  { campo:'Situação Final',      origem:'alunos.situacaoCenso',  destino:'Registro 30 - Posição 17',     obrigatorio:true,  status:'alerta', obs:'Deve ser preenchida na Etapa 2 - Situação do Aluno' },
]

export function ConfiguracoesCensoTab() {
  const { censoConfig, setCensoConfig, logCensoAction } = useData()
  const [draft, setDraft] = useState({ ...censoConfig })
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<'geral'|'mapeamento'>('geral')

  const handleSave = () => {
    setCensoConfig({ ...draft, updatedAt: new Date().toISOString() })
    logCensoAction('Configuração', 'Configurações do Censo atualizadas', { valorAnterior: JSON.stringify(censoConfig), valorNovo: JSON.stringify(draft) })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mapeamentosOk    = MAPEAMENTOS.filter(m => m.status === 'ok').length
  const mapeamentosAler  = MAPEAMENTOS.filter(m => m.status === 'alerta').length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Configurações do Censo</h2>
        <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>Parâmetros, mapeamento de campos e tabelas auxiliares</p>
      </div>

      {/* SUB-TABS */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid hsl(var(--border-subtle))' }}>
        {[
          { key:'geral', label:'⚙️ Configurações Gerais', icon:<Settings size={14}/> },
          { key:'mapeamento', label:'🗺️ Mapeamento ERP → Censo', icon:<Map size={14}/> },
        ].map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key as any)} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'8px 16px', background:'transparent', border:'none',
            borderBottom: activeSection===s.key ? '2px solid #6366f1':'2px solid transparent',
            color: activeSection===s.key ? '#818cf8':'hsl(var(--text-muted))',
            cursor:'pointer', fontSize:13, fontWeight: activeSection===s.key ? 700:500,
            marginBottom:-1, transition:'all 0.15s',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'geral' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:20 }}>
          {/* CONFIGURAÇÕES GERAIS */}
          <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:16, padding:24 }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
              <Settings size={16} color="#6366f1"/> Parâmetros do Processo
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label className="form-label">Ano Censitário Ativo</label>
                <input
                  className="form-input"
                  type="number"
                  min={2020} max={2030}
                  value={draft.anoCensitario}
                  onChange={e => setDraft(d => ({ ...d, anoCensitario: +e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Etapa Ativa</label>
                <select className="form-input" value={draft.etapaAtiva} onChange={e => setDraft(d => ({ ...d, etapaAtiva: e.target.value as any }))}>
                  <option value="1-matricula">Etapa 1 — Código Inicial</option>
                  <option value="2-situacao">Etapa 2 — Situação do Aluno</option>
                </select>
              </div>
              <div>
                <label className="form-label">Versão do Layout INEP</label>
                <select className="form-input" value={draft.layoutVersion} onChange={e => setDraft(d => ({ ...d, layoutVersion: e.target.value }))}>
                  <option value="2024">Educacenso 2024</option>
                  <option value="2023">Educacenso 2023</option>
                  <option value="2022">Educacenso 2022</option>
                </select>
                <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginTop:4 }}>
                  Selecione o layout correspondente ao ano censitário.
                </div>
              </div>
              <div>
                <label className="form-label">Responsável pelo Processo</label>
                <input
                  className="form-input"
                  placeholder="Nome do responsável pelo Censo"
                  value={draft.responsavel}
                  onChange={e => setDraft(d => ({ ...d, responsavel: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Escopo da Exportação</label>
                <select className="form-input" value={draft.escopo} onChange={e => setDraft(d => ({ ...d, escopo: e.target.value as any }))}>
                  <option value="total">Total — todas as turmas e alunos</option>
                  <option value="parcial">Parcial — apenas registros alterados</option>
                </select>
              </div>
              <div style={{ paddingTop:8 }}>
                <button onClick={handleSave} className="btn btn-primary" style={{ gap:8, width:'100%' }}>
                  <Save size={15}/> {saved ? '✓ Salvo com sucesso!' : 'Salvar Configurações'}
                </button>
              </div>
            </div>
          </div>

          {/* INFO DO PROCESSO */}
          <div style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:16, padding:24 }}>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:20, display:'flex', alignItems:'center', gap:8 }}>
              <Database size={16} color="#10b981"/> Status do Processo
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Ano Censitário Ativo', value: censoConfig.anoCensitario },
                { label:'Etapa Ativa', value: censoConfig.etapaAtiva==='1-matricula'?'1 — Código Inicial':'2 — Situação do Aluno' },
                { label:'Layout INEP', value: `Educacenso ${censoConfig.layoutVersion}` },
                { label:'Responsável', value: censoConfig.responsavel || 'Não definido' },
                { label:'Escopo', value: censoConfig.escopo==='total'?'Total':'Parcial' },
                { label:'Última atualização', value: new Date(censoConfig.updatedAt).toLocaleString('pt-BR') },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ fontSize:12, color:'hsl(var(--text-muted))' }}>{item.label}</span>
                  <span style={{ fontSize:13, fontWeight:700 }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop:20, padding:'14px', background:'rgba(99,102,241,0.06)', borderRadius:10, border:'1px solid rgba(99,102,241,0.15)', fontSize:12, color:'hsl(var(--text-secondary))' }}>
              <strong style={{ color:'#818cf8' }}>ℹ️ Sobre o Layout:</strong> O Educacenso é o sistema oficial do INEP para coleta de dados do Censo Escolar. O layout de migração é um arquivo de texto com posições fixas por tipo de registro. Consulte o manual oficial em <a href="https://inep.gov.br/censo-escolar" target="_blank" rel="noopener" style={{ color:'#6366f1' }}>inep.gov.br/censo-escolar</a>.
            </div>
          </div>
        </div>
      )}

      {activeSection === 'mapeamento' && (
        <div>
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:10, padding:'10px 16px', display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
              <span style={{ fontWeight:800, color:'#10b981', fontSize:18 }}>{mapeamentosOk}</span>
              <span style={{ color:'hsl(var(--text-muted))' }}>campos mapeados OK</span>
            </div>
            <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:'10px 16px', display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
              <span style={{ fontWeight:800, color:'#f59e0b', fontSize:18 }}>{mapeamentosAler}</span>
              <span style={{ color:'hsl(var(--text-muted))' }}>com alertas</span>
            </div>
          </div>

          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'hsl(var(--bg-overlay))' }}>
                  {['Campo','Origem ERP','Destino Censo (INEP)','Obrigatório','Status','Observação'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, color:'hsl(var(--text-muted))', textAlign:'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MAPEAMENTOS.map(m => (
                  <tr key={m.campo} style={{ borderTop:'1px solid hsl(var(--border-subtle))' }}>
                    <td style={{ padding:'10px 14px', fontWeight:700, fontSize:12 }}>{m.campo}</td>
                    <td style={{ padding:'10px 14px' }}><code style={{ fontSize:11, background:'hsl(var(--bg-overlay))', padding:'2px 7px', borderRadius:4 }}>{m.origem}</code></td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'hsl(var(--text-muted))' }}>{m.destino}</td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>{m.obrigatorio ? <span style={{ color:'#ef4444', fontWeight:800 }}>Sim</span> : <span style={{ color:'hsl(var(--text-muted))' }}>Não</span>}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6, background: m.status==='ok'?'rgba(16,185,129,0.1)':'rgba(245,158,11,0.1)', color: m.status==='ok'?'#10b981':'#f59e0b' }}>
                        {m.status==='ok' ? '✓ OK' : '⚠ Alerta'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'hsl(var(--text-muted))', fontStyle:'italic' }}>{m.obs || '—'}</td>
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
