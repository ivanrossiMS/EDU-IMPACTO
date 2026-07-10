const text = "Relatório dinâmico enviado para a turma.\n\nVocê pode visualizar o relatório individual de cada aluno clicando nos anexos abaixo.";
const lines = text.split('\n');
const res = lines.map((line, i) => {
  const boldParts = line.split(/(\*\*.*?\*\*)/g);
  return boldParts;
});
console.log(JSON.stringify(res, null, 2));
