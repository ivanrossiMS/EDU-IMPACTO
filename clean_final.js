const fs = require('fs');

let ctx = fs.readFileSync('lib/dataContext.tsx', 'utf8');
ctx = ctx.replace(/setAgendamentos\(\[\]\);/g, '');
ctx = ctx.replace(/setFornecedoresCad\(\[\]\);/g, '');
ctx = ctx.replace(/.*setAgendamentos.*/g, '');
ctx = ctx.replace(/.*setFornecedoresCad.*/g, '');
fs.writeFileSync('lib/dataContext.tsx', ctx);

let testData = fs.readFileSync('components/configuracoes/TestDataSection.tsx', 'utf8');
testData = testData.replace(/.*setFornecedoresCad.*/g, '');
testData = testData.replace(/.*fornecedoresCad.*/g, '');
fs.writeFileSync('components/configuracoes/TestDataSection.tsx', testData);
