const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/simulados/GabaritoSimuladoModal.tsx');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Change Prova to Simulado
  content = content.replace(/GabaritoProvaModal/g, 'GabaritoSimuladoModal');
  content = content.replace(/Prova/g, 'Simulado');
  content = content.replace(/prova/g, 'simulado');

  fs.writeFileSync(filePath, content);
}
console.log('Update complete');
