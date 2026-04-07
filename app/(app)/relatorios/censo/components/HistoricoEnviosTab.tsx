'use client'
import { useState } from 'react'
import { useData } from '@/lib/dataContext'
import { type CensoOperacaoEnvio } from '@/lib/dataContext'
import { Upload, CheckSquare, Square, ExternalLink, FileText, Save, Plus } from 'lucide-react'

const CHECKLIST_TEMPLATE = [
  { id:'c1', desc:'Verificar se o arquivo foi gerado sem erros', obrigatorio:true },
  { id:'c2', desc:'Confirmar que o arquivo não contém pendências críticas', obrigatorio:true },
  { id:'c3', desc:'Fazer login no sistema Educacenso (educacenso.inep.gov.br)', obrigatorio:true },
  { id:'c4', desc:'Navegar até a opção de Migração/Importação de dados', obrigatorio:true },
  { id:'c5', desc:'Selecionar o arquivo .txt gerado e iniciar a importação', obrigatorio:true },
  { id:'c6', desc:'Aguardar o processamento e verificar o relatório de retorno', obrigatorio:true },
  { id:'c7', desc:'Anotar o número de protocolo retornado pelo sistema INEP', obrigatorio:false },
  { id:'c8', desc:'Registrar o resultado da operação neste painel', obrigatorio:false },
  { id:'c9', desc:'Salvar comprovante/print da tela de sucesso', obrigatorio:false },
]

export function HistoricoEnviosTab() {
  const { censoExports, censoOperacoes, setCensoOperacoes, censoConfig, logCensoAction } = useData()
  const [showWizard, setShowWizard] = useState(false)
  const [selectedExportId, setSelectedExportId] = useState('')
  const [checklist, setChecklist] = useState<Record<string,boolean>>({})
  const [protocolo, setProtocolo] = useState('')
  const [resultado, setResultado] = useState<CensoOperacaoEnvio['resultado']>('pendente')
  const [observacoes, setObservacoes] = useState('')
  const [comprovante, setComprovante] = useState('')

  const checkItem = (id: string) => setChecklist(prev => ({ ...prev, [id]: !prev[id] }))
  const obrigOk = CHECKLIST_TEMPLATE.filter(c => c.obrigatorio).every(c => checklist[c.id])

  const handleSalvarEnvio = () => {
    const op: CensoOperacaoEnvio = {
      id: `OP-${Date.now()}`,
      exportId: selectedExportId,
      anoCensitario: censoConfig.anoCensitario,
      etapa: censoConfig.etapaAtiva,
      dataOperacao: new Date().toISOString(),
      usuario: 'Usuário atual',
      checklist,
      protocolo,
      resultado,
      observacoes,
      comprovante,
      linkEducacenso: 'https://educacenso.inep.gov.br',
    }
    setCensoOperacoes(prev => [op, ...prev])
    logCensoAction('Operação de Envio', `Resultado registrado: ${resultado}`, {
      anoCensitario: censoConfig.anoCensitario, etapa: censoConfig.etapaAtiva,
    })
    setShowWizard(false)
    setChecklist({}); setProtocolo(''); setResultado('pendente'); setObservacoes('')
  }

  const RESULTADO_CFG: Record<string, { label:string; color:string }> = {
    enviado:           { label:'✅ Enviado com sucesso', color:'#10b981' },
    enviado_com_alerta:{ label:'⚠️ Enviado com alerta', color:'#f59e0b' },
    rejeitado:         { label:'❌ Rejeitado', color:'#ef4444' },
    pendente:          { label:'⏳ Pendente', color:'#94a3b8' },
    aguardando:        { label:'🕐 Aguardando retorno', color:'#6366f1' },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Histórico de Envios</h2>
          <p style={{ fontSize:13, color:'hsl(var(--text-muted))', margin:'4px 0 0' }}>Registre e acompanhe as operações de envio ao Educacenso</p>
        </div>
        <button onClick={() => setShowWizard(true)} className="btn btn-primary" style={{ gap:8 }}>
          <Plus size={15}/> Nova Operação de Envio
        </button>
      </div>

      {/* AVISO */}
      <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:12, padding:'14px 18px', fontSize:12, color:'hsl(var(--text-secondary))' }}>
        <strong style={{ color:'#818cf8' }}>ℹ️ Como funciona o envio ao Educacenso:</strong> Não existe integração direta via API com o INEP. Após gerar o arquivo na aba "Geração de Arquivos", você deve:<br/>
        1) Baixar o arquivo .txt → 2) Acessar <a href="https://educacenso.inep.gov.br" target="_blank" rel="noopener" style={{ color:'#6366f1' }}>educacenso.inep.gov.br</a> → 3) Fazer a importação no sistema oficial → 4) Registrar o resultado aqui.
      </div>

      {/* LISTA DE OPERAÇÕES */}
      {censoOperacoes.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'hsl(var(--text-muted))', background:'hsl(var(--bg-surface))', borderRadius:16, border:'1px solid hsl(var(--border-subtle))' }}>
          <Upload size={40} style={{ opacity:0.15, display:'block', margin:'0 auto 12px' }}/>
          <div style={{ fontWeight:700, marginBottom:8 }}>Nenhuma operação de envio registrada</div>
          <div style={{ fontSize:13 }}>Após enviar ao Educacenso, clique em "Nova Operação de Envio" para registrar o resultado.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {censoOperacoes.map(op => {
            const resCfg = RESULTADO_CFG[op.resultado]
            const exp = censoExports.find(e => e.id === op.exportId)
            return (
              <div key={op.id} style={{ background:'hsl(var(--bg-surface))', border:'1px solid hsl(var(--border-subtle))', borderRadius:14, padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:12 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:14 }}>
                      Operação — {op.etapa==='1-matricula'?'Etapa 1':'Etapa 2'} · {op.anoCensitario}
                    </div>
                    <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:2 }}>
                      {new Date(op.dataOperacao).toLocaleString('pt-BR')} · por {op.usuario}
                    </div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:resCfg.color }}>{resCfg.label}</span>
                </div>
                {exp && <div style={{ fontSize:11, color:'hsl(var(--text-muted))', marginBottom:8 }}>Arquivo: <code style={{ background:'hsl(var(--bg-overlay))', padding:'1px 5px', borderRadius:3 }}>{exp.nomeArquivo}</code></div>}
                {op.protocolo && <div style={{ fontSize:12, marginBottom:6 }}><strong>Protocolo INEP:</strong> {op.protocolo}</div>}
                {op.observacoes && <div style={{ fontSize:12, color:'hsl(var(--text-secondary))' }}>{op.observacoes}</div>}
                <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(op.checklist).filter(([,v])=>v).map(([k]) => {
                    const item = CHECKLIST_TEMPLATE.find(c=>c.id===k)
                    return item ? <span key={k} style={{ fontSize:10, padding:'2px 7px', background:'rgba(16,185,129,0.1)', color:'#10b981', borderRadius:4, fontWeight:600 }}>✓ {item.desc.slice(0,30)}...</span> : null
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* WIZARD MODAL */}
      {showWizard && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(4px)' }}>
          <div style={{ background:'hsl(var(--bg-surface))', borderRadius:20, width:'90%', maxWidth:620, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', border:'1px solid hsl(var(--border-subtle))' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid hsl(var(--border-subtle))', background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(16,185,129,0.04))' }}>
              <div style={{ fontWeight:800, fontSize:16 }}>Nova Operação de Envio</div>
              <div style={{ fontSize:12, color:'hsl(var(--text-muted))', marginTop:4 }}>Siga o checklist e registre o resultado do envio ao Educacenso</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:20 }}>

              {/* SELEÇÃO DE ARQUIVO */}
              <div>
                <label className="form-label">Arquivo Gerado</label>
                <select className="form-input" value={selectedExportId} onChange={e => setSelectedExportId(e.target.value)}>
                  <option value="">— Selecionar arquivo —</option>
                  {censoExports.map(e => <option key={e.id} value={e.id}>{e.nomeArquivo}</option>)}
                </select>
              </div>

              {/* BOTÃO EDUCACENSO */}
              <a href="https://educacenso.inep.gov.br" target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, textDecoration:'none', color:'#818cf8', fontWeight:700, fontSize:13 }}
              >
                <ExternalLink size={16}/> Abrir sistema Educacenso (INEP)
              </a>

              {/* CHECKLIST */}
              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Checklist de Envio</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {CHECKLIST_TEMPLATE.map(item => (
                    <div
                      key={item.id}
                      onClick={() => checkItem(item.id)}
                      style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', borderRadius:10, background: checklist[item.id]?'rgba(16,185,129,0.06)':'hsl(var(--bg-elevated))', cursor:'pointer', border:`1px solid ${checklist[item.id]?'rgba(16,185,129,0.2)':'hsl(var(--border-subtle))'}`, transition:'all 0.15s' }}
                    >
                      {checklist[item.id] ? <CheckSquare size={16} color="#10b981" style={{ flexShrink:0, marginTop:2 }}/> : <Square size={16} style={{ flexShrink:0, marginTop:2, opacity:0.4 }}/>}
                      <div>
                        <span style={{ fontSize:12, fontWeight:600 }}>{item.desc}</span>
                        {item.obrigatorio && <span style={{ fontSize:10, color:'#ef4444', marginLeft:6, fontWeight:700 }}>*</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RESULTADO */}
              <div>
                <label className="form-label">Resultado do Envio</label>
                <select className="form-input" value={resultado} onChange={e => setResultado(e.target.value as any)}>
                  {Object.entries(RESULTADO_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Protocolo INEP (se recebido)</label>
                <input className="form-input" placeholder="Ex: 2024-0001234" value={protocolo} onChange={e => setProtocolo(e.target.value)}/>
              </div>
              <div>
                <label className="form-label">Observações</label>
                <textarea className="form-input" rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} style={{ resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid hsl(var(--border-subtle))', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button className="btn btn-ghost" onClick={() => setShowWizard(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSalvarEnvio} disabled={!obrigOk} style={{ gap:8 }}>
                <Save size={14}/> Registrar Operação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
