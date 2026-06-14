const fs = require('fs');
const content = fs.readFileSync('app/(app)/academico/alunos/page.tsx', 'utf-8');
const handleSaveMatch = content.match(/const handleSaveAluno = .*?}\n  }/s);
if (handleSaveMatch) console.log(handleSaveMatch[0].substring(0, 1500));
