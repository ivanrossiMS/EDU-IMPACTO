const turmaObj = { id: 'uuid-1234' };
const alunoEncontrado = { id: 'uuid-aluno', turma: null, turma_id: undefined };
const turma_id = alunoEncontrado?.turma || alunoEncontrado?.turma_id || turmaObj?.id;
console.log('turma_id is falsy?', !turma_id, 'value:', turma_id);
