const fs = require('fs');
const content = fs.readFileSync('app/agenda-digital/colaborador/comunicados/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.toLowerCase().includes('conversas')) {
    console.log(i + 1, line);
  }
});
