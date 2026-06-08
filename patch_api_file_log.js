const fs = require('fs');
const filePath = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/api/ocorrencias/route.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
    "console.log('GET OCORRENCIAS:', data?.length, 'error:', error);",
    "require('fs').appendFileSync('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/ocorrencias_log.txt', new Date().toISOString() + ' GET OCORRENCIAS: ' + (data ? data.length : 'null') + '\\n');"
);
fs.writeFileSync(filePath, code);
