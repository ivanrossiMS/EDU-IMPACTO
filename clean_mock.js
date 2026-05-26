const fs = require('fs');

function cleanFile(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/agendamentos(:\s*any\[\]\s*=\s*\[\])?,?/g, '');
        content = content.replace(/fornecedores(:\s*any\[\]\s*=\s*\[\])?,?/g, '');
        fs.writeFileSync(filePath, content);
        console.log('Cleaned ' + filePath);
    }
}

cleanFile('lib/mockDb.ts');
cleanFile('lib/dataContext.tsx');
