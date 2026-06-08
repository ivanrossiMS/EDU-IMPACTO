const fs = require('fs');
const filePath = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/api/ocorrencias/route.ts';
let code = fs.readFileSync(filePath, 'utf8');

const backupPath = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/api/ocorrencias/route.ts.backup';
fs.writeFileSync(backupPath, code);

// Mock requireAuth to bypass auth
code = code.replace(
  "const { user, errorResponse } = await requireAuth()",
  "const { user, errorResponse } = { user: { id: 'test_admin', email: 'test@example.com' }, errorResponse: null };"
);

fs.writeFileSync(filePath, code);
