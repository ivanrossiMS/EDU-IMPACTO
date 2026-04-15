const fs = require('fs');
let code = fs.readFileSync('page.tsx', 'utf8');

code = code.replace(/value=\{aluno\.([a-zA-Z0-9]+)\}/g, "value={aluno.$1 || ''}");
code = code.replace(/value=\{resp\.([a-zA-Z0-9]+)\}/g, "value={resp.$1 || ''}");
code = code.replace(/value=\{aut\.([a-zA-Z0-9]+)\}/g, "value={aut.$1 || ''}");
code = code.replace(/\|\| '' \|\| ''/g, "|| ''");

fs.writeFileSync('page.tsx', code);
