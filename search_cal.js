const fs = require('fs');
const content = fs.readFileSync('app/agenda-digital/admin/calendario/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Novo Evento')) {
    console.log(i + 1, line);
  }
});
