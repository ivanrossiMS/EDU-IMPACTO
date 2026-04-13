const fs = require('fs');
const filepath = 'c:/Users/ivanr/OneDrive/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/(app)/academico/alunos/nova-matricula/page.tsx';
let lines = fs.readFileSync(filepath, 'utf8').split(/\r?\n/);

const injection = `
    // --- Persiste os responsáveis de forma atômica no BD separados ---
    if (activeInternalId && payload.nome && payload.nome.trim()) {
       for (const r of todosResp) {
          if (r.nome && r.nome.trim().length >= 2) {
             const rPayload = {
                   id: r.id && r.id.includes('-') ? r.id : undefined,
                   nome: r.nome.trim(),
                   cpf: r.cpf ? r.cpf.replace(/\\D/g, '') : null,
                   rg: r.rg || null,
                   sexo: r.sexo || null,
                   data_nasc: r.dataNasc || null,
                   email: r.email || null,
                   telefone: r.celular || null,
                   profissao: r.profissao || null,
                   parentesco: r.parentesco || r.tipo,
                   estado_civil: r.estadoCivil || null,
                   codigo: r.codigo || null,
                   obs: r.obs || null,
                   dados: { respPedagogico: r.respPedagogico, respFinanceiro: r.respFinanceiro },
                   endereco: r.endereco,
                   alunos_vinculados: [{
                       aluno_id: activeInternalId,
                       nome: payload.nome,
                       turma: payload.turma || '',
                       parentesco: r.parentesco || r.tipo,
                       resp_pedagogico: r.respPedagogico,
                       resp_financeiro: r.respFinanceiro
                   }]
             }
             fetch('/api/responsaveis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rPayload)
             }).catch(e => console.error('Erro salvar responsável (Finalizar):', e))
          }
       }
    }
`;

lines.splice(1409, 0, injection.trimEnd());

fs.writeFileSync(filepath, lines.join('\n'));
console.log('Injected via node');
