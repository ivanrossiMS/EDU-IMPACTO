const fs = require('fs');
const filePath = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/api/ocorrencias/route.ts';
let code = fs.readFileSync(filePath, 'utf8');

if (!code.includes("console.log('GET OCORRENCIAS:', data?.length, 'error:', error)")) {
    code = code.replace(
        "const { data, error } = await query",
        "const { data, error } = await query;\n  console.log('GET OCORRENCIAS:', data?.length, 'error:', error);"
    );
    fs.writeFileSync(filePath, code);
}
console.log("Patched api");
