const fs = require('fs');
const p = 'app/(app)/academico/alunos/nova-matricula/page.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(/if\(editHistId\) setHistorico\(prev=>\{[\s\S]*?return updated\r?\n\s*\}\)\r?\n\s*else setHistorico\(prev=>\{[\s\S]*?return updated\r?\n\s*\}\)/,
`const updated = editHistId ? historico.map(h=>h.id===editHistId?item:h) : [...historico, item];
                            const ativa = updated.find(h=>h.situacao==='Cursando') || updated[updated.length-1];
                            if(ativa?.turmaId) setMat(m=>({...m, turmaId:ativa.turmaId, turno:ativa.turno||m.turno}));
                            sincronizarTurmaAluno(updated);
                            setHistorico(updated);`);

txt = txt.replace(/responsaveis: todosResp,/, 'responsaveis: todosResp.filter(r=>r.nome.trim().length>0),');

// Fix infinite hook
txt = txt.replace(/  \}, \[parcelas, salvando\]\)/, '  }, [parcelas])');

fs.writeFileSync(p, txt, 'utf8');
console.log('Fixed');
