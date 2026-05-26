const fs = require('fs');

let testData = fs.readFileSync('components/configuracoes/TestDataSection.tsx', 'utf8');

testData = testData.replace(/fornecedoresCad: \[\], setFornecedoresCad: \(p: any\) => \{\},/g, '');
testData = testData.replace(/fornecedoresCad: f\.fornecedores \|\| \[\], setFornecedoresCad: \(f: any\) => \{\},/g, '');
testData = testData.replace(/fornecedoresCad: f\.fornecedores \|\| \[\],/g, '');
testData = testData.replace(/setFornecedoresCad: \(p: any\) => x\('fornecedores', p\),/g, '');

fs.writeFileSync('components/configuracoes/TestDataSection.tsx', testData);
