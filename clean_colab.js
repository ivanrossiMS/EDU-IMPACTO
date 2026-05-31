const fs = require('fs');

let code = fs.readFileSync('app/agenda-digital/colaborador/comunicados/page.tsx', 'utf8');

// Remove useEffect
code = code.replace(/\/\/ Sync editor content only on showComposer.*?\}, \[showComposer\]\);\n/gs, '');
code = code.replace(/\/\/ Sync editor content only on showComposer.*?\}, \[showComposer, editComId\]\);\n/gs, '');

fs.writeFileSync('app/agenda-digital/colaborador/comunicados/page.tsx', code);
