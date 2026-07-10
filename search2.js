const fs = require('fs');
const content = fs.readFileSync('components/agenda/ComunicadoViewModal.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Trash2') || line.includes('Edit2')) {
    console.log(i + 1, line);
  }
});
