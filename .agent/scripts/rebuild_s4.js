const fs = require('fs');
const p = 'app/(app)/academico/alunos/nova-matricula/page.tsx';
let txt = fs.readFileSync(p, 'utf8');

const regex = /<div key="s4"[\s\S]*?(?=\/\/ STEP 5|<!-- STEP 5)/;

const replacement = `<div key="s4" style={{display:'flex',flexDirection:'column',gap:0,minHeight:600,background:'hsl(var(--bg-base))', position:'relative', paddingBottom: 40}}>
      {/* HEADER DA ABA */}
      <div style={{padding:'20px 24px',background:'linear-gradient(90deg, #1e293b, #0f172a)',display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.4)',color:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:18}}>5</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6,color:'hsl(var(--text-muted))',fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>
            FINANCEIRO · CÓD. {(alunoEditando as any)?.codigo || aluno.codigo || ''}
          </div>
          <div style={{color:'#f8fafc',fontWeight:800,fontSize:18,letterSpacing:0.5}}>{aluno.nome || (alunoEditando as any)?.nome || 'Novo Aluno'}</div>
        </div>
        <div style={{flex:1, borderLeft:'1px solid rgba(255,255,255,0.1)', paddingLeft:16}}>
           <div style={{color:'hsl(var(--text-muted))',fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>RESP. FINANCEIRO</div>
           <div style={{color:'#38bdf8',fontWeight:700,fontSize:13}}>{todosResp.find(r=>r.respFinanceiro)?.nome || mae.nome || 'Não informado'}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setModalObsAluno(true)} style={{fontSize:11, color:'#fbbf24', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)'}}>
          ✏️ Obs. Financeira
        </button>
        {parcelasConfirmadas && <div style={{padding:'4px 12px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'#10b981', fontSize:11, fontWeight:700}}>✓ Confirmadas</div>}
      </div>

      <div style={{padding:'20px 24px'}}>
        {(() => {
          if (!parcelasConfirmadas || parcelas.length === 0) {
            return (
              <div style={{textAlign:'center',padding:'40px 20px',color:'hsl(var(--text-muted))',background:'hsl(var(--bg-elevated))',borderRadius:16,border:'1px dashed hsl(var(--border-strong))'}}>
                Nenhuma parcela gerada ou confirmada ainda.<br/><span style={{fontSize:12}}>Revise a Matrícula (Passo 4) ou gere parcelas avulsas.</span>
              </div>
            )
          }

          const sA = ['pendente','vencido','pago']
          const pFilt = parcelas.filter(p => sA.includes(p.status) )
          const aV = pFilt.filter(p => !((p as any).status === 'vencido') && p.status !== 'pago')
          const ven = pFilt.filter(p => ((p as any).status === 'vencido') && p.status !== 'pago')

          const sA_all = ['pendente','vencido','pago'];
          const parcsAtivas = parcelas.filter(p => sA_all.includes(p.status));
          const totalBruto = parcsAtivas.reduce((s,p)=>s+p.valor,0);
          const totalDesc = parcsAtivas.reduce((s,p)=>s+p.desconto,0);
          const totalEncargos = parcsAtivas.reduce((s,p)=>s+((p as any).juros||0)+((p as any).multa||0),0);
          const totalLiq = parcsAtivas.reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0);
          const totalPago = parcsAtivas.filter(p=>p.status==='pago').reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0);

          const isAllSelected = pFilt.length > 0 && parcelasSelected.length === pFilt.length;

          return (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              
              {/* 4 SUMMARY CARDS */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16}}>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'hsl(var(--text-muted))',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:'#fbbf24'}}/> TOTAL BRUTO
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'hsl(var(--text-base))',marginTop:8}}>R$ {fmtMoeda(totalBruto)}</div>
                 </div>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'hsl(var(--bg-elevated))',border:'1px dashed #fb923c',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#ea580c',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      🏷️ DESCONTOS
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'#ea580c',marginTop:8}}>R$ {fmtMoeda(totalDesc)}</div>
                 </div>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'rgba(16,185,129,0.05)',border:'1px solid rgba(16,185,129,0.3)',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#059669',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      ☑️ TOTAL LÍQUIDO
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'#10b981',marginTop:4}}>R$ {fmtMoeda(totalLiq)}</div>
                    <div style={{fontSize:9,color:'#059669',marginTop:2}}>incl. R$ {fmtMoeda(totalEncargos)} encargos</div>
                 </div>
                 <div className="card" style={{padding:'16px',borderRadius:16,background:'hsl(var(--bg-elevated))',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 2px 8px rgba(0,0,0,0.02)'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#3b82f6',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:16,height:3,background:'#38bdf8',borderRadius:2}}/> RECEBIDO
                    </div>
                    <div style={{fontSize:22,fontWeight:900,color:'#6366f1',marginTop:8}}>R$ {fmtMoeda(totalPago)}</div>
                 </div>
              </div>

              {/* 4 PANELS GRID */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16}}>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid rgba(16,185,129,0.3)',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}><div style={{width:8,height:8,background:'#10b981',transform:'rotate(45deg)'}}/> LIQUIDAÇÃO & GESTÃO</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalBaixaLote(true)}} style={{fontSize:11,background:'rgba(16,185,129,0.1)',color:'#059669',border:'1px solid rgba(16,185,129,0.2)'}}>💳 Baixar</button>
                       <button type="button" className="btn btn-sm" onClick={()=>{}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#6366f1',border:'1px solid hsl(var(--border-subtle))'}}>✏️ Editar</button>
                       <button type="button" className="btn btn-sm" onClick={()=>{}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}}>🏦 Baixa Resp.</button>
                       <button type="button" className="btn btn-sm" onClick={()=>{}} style={{fontSize:11,background:'rgba(239,68,68,0.05)',color:'#ef4444',border:'1px dashed rgba(239,68,68,0.3)'}}>🗑️ Excluir</button>
                    </div>
                 </div>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid rgba(139,92,246,0.2)',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>🛠️ LANÇAMENTOS MANUAIS</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalAdicionarEvento(true)}} style={{fontSize:11,background:'rgba(139,92,246,0.1)',color:'#7c3aed',border:'1px solid rgba(139,92,246,0.2)'}}>➕ Inserir Evento</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalDescontoLote(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#ea580c',border:'1px solid hsl(var(--border-subtle))'}}>🏷️ Descontos</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalVencimentoLote(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#38bdf8',border:'1px solid hsl(var(--border-subtle))'}}>📅 Vencimento</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalValorLote(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#10b981',border:'1px solid hsl(var(--border-subtle))'}}>💰 Alt. Valor</button>
                    </div>
                 </div>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid hsl(var(--border-strong))',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>🔍 CONSULTAS & ESTORNO</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalConsultaBaixa(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#3b82f6',border:'1px solid hsl(var(--border-subtle))'}}>🔍 Cons. Baixa</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}}>🗑️ Excluir Baixa</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'#fbbf24',border:'1px solid hsl(var(--border-subtle))'}}>📄 Extrato</button>
                       <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalItensExcluidos(true)}} style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}}>🗑️ Excluidos</button>
                    </div>
                 </div>
                 <div className="card" style={{padding:'14px',borderRadius:12,border:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-elevated))'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'hsl(var(--text-base))',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>🏦 COBRANÇA BANCÁRIA</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                       <button type="button" className="btn btn-sm" style={{gridColumn:'span 2',fontSize:11,background:'hsl(var(--bg-base))',color:'#6366f1',border:'1px solid hsl(var(--border-subtle))'}}>📄 Histórico</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'rgba(14,165,233,0.1)',color:'#0284c7',border:'1px solid rgba(14,165,233,0.2)'}}>🧾 Emitir Boleto</button>
                       <button type="button" className="btn btn-sm" style={{fontSize:11,background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',border:'1px solid hsl(var(--border-subtle))'}}>⚡ 2ª Via</button>
                    </div>
                 </div>
              </div>

              {/* TABLE CONTROLS */}
              <div style={{padding:'10px 0', display:'flex', alignItems:'center', gap:10}}>
                 <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,fontWeight:700,cursor:'pointer',background:'hsl(var(--bg-elevated))',padding:'6px 12px',borderRadius:8,border:'1px solid hsl(var(--border-subtle))'}}>
                   <input type="checkbox" checked={isAllSelected} onChange={(e) => {
                       if (e.target.checked) setParcelasSelected(pFilt.map(p => p.num))
                       else setParcelasSelected([])
                   }} style={{cursor:'pointer', width:14, height:14}}/> Sel. Todos
                 </label>
                 <div style={{display:'flex',background:'hsl(var(--bg-elevated))',borderRadius:8,border:'1px solid hsl(var(--border-subtle))',overflow:'hidden'}}>
                   <button type="button" className="btn btn-sm" style={{borderRadius:0,border:0,borderRight:'1px solid hsl(var(--border-subtle))',background:fin._filtro==='todos'?'rgba(99,102,241,0.1)':'transparent',color:fin._filtro==='todos'?'#6366f1':'hsl(var(--text-muted))',fontSize:11, fontWeight:700}} onClick={(e)=>{e.preventDefault(); setFin((f:any)=>({...f,_filtro:'todos'}))}}>Todos ({parcelas.filter(p=>p.status!=='cancelado').length})</button>
                   <button type="button" className="btn btn-sm" style={{borderRadius:0,border:0,borderRight:'1px solid hsl(var(--border-subtle))',background:fin._filtro==='pendente'?'rgba(239,68,68,0.1)':'transparent',color:fin._filtro==='pendente'?'#ef4444':'hsl(var(--text-muted))',fontSize:11, fontWeight:700}} onClick={(e)=>{e.preventDefault(); setFin((f:any)=>({...f,_filtro:'pendente'}))}}>A Vencer / Vencidos ({aV.length + ven.length})</button>
                   <button type="button" className="btn btn-sm" style={{borderRadius:0,border:0,background:fin._filtro==='pago'?'rgba(16,185,129,0.1)':'transparent',color:fin._filtro==='pago'?'#10b981':'hsl(var(--text-muted))',fontSize:11, fontWeight:700}} onClick={(e)=>{e.preventDefault(); setFin((f:any)=>({...f,_filtro:'pago'}))}}>Pago ({parcelas.filter(p=>p.status==='pago').length})</button>
                 </div>

                 {parcelasSelected.length > 0 && (
                   <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8, background:'rgba(99,102,241,0.05)', padding:'6px 12px', borderRadius:20, border:'1px solid rgba(99,102,241,0.3)', color:'#6366f1', fontSize:11, fontWeight:800}}>
                     I R$ {fmtMoeda(pFilt.filter(p=>parcelasSelected.includes(p.num)).reduce((s,p)=>s+p.valor,0))} ×
                   </div>
                 )}
                 <button type="button" className="btn btn-sm" onClick={(e)=>{e.preventDefault(); setModalAdicionarEvento(true)}} style={{marginLeft:parcelasSelected.length>0?0:'auto', background:'linear-gradient(135deg, #8b5cf6, #6366f1)', color:'#fff', border:'none', fontSize:11, fontWeight:800, padding:'6px 16px', borderRadius:20, boxShadow:'0 0 10px rgba(99,102,241,0.4)'}}>+ Adicionar Evento</button>
              </div>

              {/* TABLE */}
              <div style={{background:'hsl(var(--bg-elevated))', borderRadius:12, border:'1px solid hsl(var(--border-subtle))', overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.03)'}}>
                 <table className="table" style={{margin:0,width:'100%',borderCollapse:'collapse'}}>
                    <thead style={{background:'hsl(var(--bg-base))',color:'hsl(var(--text-muted))',fontWeight:800,fontSize:10,textTransform:'uppercase',letterSpacing:.5, borderBottom:'2px solid hsl(var(--border-subtle))'}}>
                      <tr>
                        <th style={{padding:'14px 8px 14px 16px',width:30}}><input type="checkbox" style={{opacity:0}}/></th>
                        <th style={{padding:'14px',width:50,textAlign:'center'}}>PARC.</th>
                        <th style={{padding:'14px'}}>EVENTO / COMPETÊNCIA</th>
                        <th style={{padding:'14px',textAlign:'center'}}>VENCIMENTO</th>
                        <th style={{padding:'14px',textAlign:'right'}}>VALOR BRUTO</th>
                        <th style={{padding:'14px',textAlign:'center'}}>DESCONTO</th>
                        <th style={{padding:'14px',textAlign:'right'}}>JUROS</th>
                        <th style={{padding:'14px',textAlign:'right'}}>MULTA</th>
                        <th style={{padding:'14px',textAlign:'right'}}>TOTAL A PAGAR</th>
                        <th style={{padding:'14px',textAlign:'center'}}>PAGAMENTO</th>
                        <th style={{padding:'14px',textAlign:'center'}}>AÇÃO</th>
                        <th style={{padding:'14px',textAlign:'center'}}>DT. EMISSÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pFilt.map((p, idx) => {
                         const sel = parcelasSelected.includes(p.num);
                         const isVencido = p.status === 'vencido';
                         const isPago = p.status === 'pago';
                         const bgColor = sel ? 'rgba(99,102,241,0.05)' : idx%2===0?'transparent':'hsl(var(--bg-base))';
                         
                         const mantemDesc = (p as any).manterDescontoApósVencimento;

                         return (
                           <tr key={p.num} onClick={()=>setParcelasSelected(prev=>prev.includes(p.num)?prev.filter(x=>x!==p.num):[...prev,p.num])} style={{background:bgColor, borderBottom:'1px solid hsl(var(--border-subtle))', cursor:'pointer', transition:'all 0.2s'}}>
                             <td style={{padding:'14px 8px 14px 16px'}}><input type="checkbox" checked={sel} readOnly style={{cursor:'pointer', width:14, height:14, accentColor:'#6366f1'}}/></td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               {mat?.turmaId ? <div style={{fontSize:8,fontWeight:800,color:'#8b5cf6',marginBottom:4, whiteSpace:'nowrap'}}>{p.turma||mat?.turmaId}</div> : null}
                               <div style={{fontSize:14,fontWeight:900,color:isVencido?'#ef4444':'#6366f1'}}>{p.num}</div>
                               <div style={{fontSize:9,color:'hsl(var(--text-muted))',marginTop:2}}>/{(p as any).totalParc||mat.totalParcelas||1}</div>
                             </td>
                             <td style={{padding:'14px'}}>
                               <div style={{fontSize:12,fontWeight:800,color:'hsl(var(--text-base))'}}>{p.evento || 'Mensalidade'}</div>
                               <div style={{fontSize:10,color:'hsl(var(--text-muted))',marginTop:2}}>{p.competencia || 'Competência'}</div>
                               <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:800,background:isVencido?'rgba(239,68,68,0.1)':isPago?'rgba(16,185,129,0.1)':'rgba(56,189,248,0.1)',color:isVencido?'#ef4444':isPago?'#10b981':'#38bdf8'}}>
                                 {isVencido?'⚠️ Vencido':isPago?'✓ Pago':'• Pendente'}
                               </div>
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               <div style={{fontSize:12,fontWeight:800,color:isVencido?'#ef4444':'hsl(var(--text-base))'}}>{p.vencimento}</div>
                               {isVencido && <div style={{fontSize:9,color:'#ef4444',marginTop:4}}>{(p as any).diasAtraso || 0}d atraso</div>}
                               {isPago && <div style={{fontSize:9,color:'#10b981',marginTop:4}}>pago em {p.dtPagto}</div>}
                             </td>
                             <td style={{padding:'14px',textAlign:'right',fontSize:13,fontWeight:800,fontFamily:'monospace'}}>R$ {fmtMoeda(p.valor)}</td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               {p.desconto > 0 ? (
                                 <>
                                   <div style={{fontSize:11,fontWeight:800,color:'#ea580c',fontFamily:'monospace'}}>- R$ {fmtMoeda(p.desconto)} <span style={{fontSize:9}}>({((p.desconto/p.valor)*100).toFixed(1)}%)</span></div>
                                   {isVencido && !mantemDesc ? (
                                     <div style={{fontSize:9,color:'#ef4444',marginTop:6,display:'inline-flex',flexDirection:'column'}}>
                                       <span style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',padding:'2px 6px',borderRadius:20}}>❌ Perde Desc.</span>
                                       <span style={{fontSize:8,marginTop:2}}>(perdido no vcto)</span>
                                     </div>
                                   ) : (
                                     <div style={{fontSize:9,color:'#10b981',marginTop:6,display:'inline-flex',flexDirection:'column'}}>
                                       <span style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.2)',padding:'2px 6px',borderRadius:20}}>✔️ Mantém Desc.</span>
                                     </div>
                                   )}
                                 </>
                               ) : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}
                             </td>
                             <td style={{padding:'14px',textAlign:'right',fontSize:12,fontWeight:800,color:'#ef4444',fontFamily:'monospace'}}>{(p as any).juros>0 ? \`R$ \${fmtMoeda((p as any).juros)}\` : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}</td>
                             <td style={{padding:'14px',textAlign:'right',fontSize:12,fontWeight:800,color:'#ef4444',fontFamily:'monospace'}}>{(p as any).multa>0 ? \`R$ \${fmtMoeda((p as any).multa)}\` : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}</td>
                             <td style={{padding:'14px',textAlign:'right'}}>
                               <div style={{fontSize:13,fontWeight:900,color:(isVencido || (p as any).juros>0)?'#ef4444':'hsl(var(--text-base))',fontFamily:'monospace'}}>R$ {fmtMoeda(p.valorFinal+((p as any).juros||0)+((p as any).multa||0))}</div>
                               {((p as any).juros>0 || (p as any).multa>0) && <div style={{fontSize:9,color:'#ef4444',marginTop:4}}>c/ encargos</div>}
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               {isPago ? <div style={{fontSize:11,fontWeight:800,color:'#10b981'}}>Pago</div> : <span style={{color:'hsl(var(--border-strong))'}}>—</span>}
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               <div style={{fontSize:10,color:'hsl(var(--text-muted))'}}>Sem boleto</div>
                             </td>
                             <td style={{padding:'14px',textAlign:'center'}}>
                               <div style={{fontSize:10,fontWeight:700,color:'#6366f1',background:'rgba(99,102,241,0.05)',padding:'4px 8px',borderRadius:4,display:'inline-flex',alignItems:'center',gap:4}}>
                                 🗓️ {new Date().toLocaleDateString('pt-BR')}
                               </div>
                             </td>
                           </tr>
                         )
                      })}
                    </tbody>
                 </table>
                 
                 {/* Footer Sumário */}
                 <div style={{display:'flex',alignItems:'center',gap:16,padding:'16px 24px',fontSize:11,color:'hsl(var(--text-muted))',background:'hsl(var(--bg-elevated))', borderTop:'2px solid hsl(var(--border-subtle))'}}>
                   <div style={{fontWeight:700}}>Total · {pFilt.length} parcelas</div>
                   <div style={{fontWeight:700}}>A Vencer: {aV.length} · <span style={{color:'#ef4444'}}>Vencido: {ven.length}</span></div>
                   <div style={{marginLeft:'auto',display:'flex',gap:24,fontFamily:'monospace',fontSize:13,fontWeight:800,color:'hsl(var(--text-base))'}}>
                      <span>R$ {fmtMoeda(totalBruto)}</span>
                      <span style={{color:'#ea580c'}}>- R$ {fmtMoeda(totalDesc)}</span>
                      <span style={{color:'#ef4444'}}>+ R$ {fmtMoeda(totalEncargos)}</span>
                      <span style={{color:'#10b981'}}>R$ {fmtMoeda(totalLiq)}</span>
                   </div>
                 </div>
                 
                 <div style={{padding:'12px 24px',display:'flex',gap:24,fontSize:10,fontWeight:800,textTransform:'uppercase',borderTop:'1px solid hsl(var(--border-subtle))',background:'hsl(var(--bg-base))'}}>
                   <span style={{color:'hsl(var(--text-muted))'}}>A Vencer <span style={{color:'#6366f1'}}>R$ {fmtMoeda(aV.reduce((s,p)=>s+p.valorFinal,0))}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Vencido <span style={{color:'#ef4444'}}>R$ {fmtMoeda(ven.reduce((s,p)=>s+p.valorFinal+((p as any).juros||0)+((p as any).multa||0),0))} {ven.length>0 && <span style={{background:'rgba(239,68,68,0.1)',padding:'2px 4px',borderRadius:4,fontSize:8,marginLeft:4}}>ATRASO</span>}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Recebido: <span style={{color:'#10b981'}}>R$ {fmtMoeda(totalPago)}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Parcelas <span style={{color:'hsl(var(--text-base))'}}>{parcelas.filter(p=>p.status!=='cancelado').length}</span></span>
                   <span style={{color:'hsl(var(--text-muted))'}}>Canceladas <span style={{color:'#ef4444'}}>{parcelas.filter(p=>p.status==='cancelado').length}</span></span>
                 </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>,

// STEP 5: Contratos`;

txt = txt.replace(regex, replacement);
fs.writeFileSync(p, txt, 'utf8');
console.log('Rebuild Complete.');
