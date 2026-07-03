const fs = require('fs');
const path = require('path');

const files = [
  'app/(app)/simulados/simulados-upload/page.tsx',
  'app/(app)/simulados/simulados-upload/nova/page.tsx',
  'app/(app)/simulados/simulados-upload/[id]/upload/page.tsx',
  'supabase/migrations/20260702_simulados_upload.sql'
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Database tables and columns
  content = content.replace(/provas_upload/g, 'simulados_upload');
  content = content.replace(/id_prova_upload/g, 'id_simulado_upload');
  
  // URLs and Routing
  content = content.replace(/\/simulados\/provas-upload/g, '/simulados/simulados-upload');
  
  // UI Texts
  content = content.replace(/Provas por Upload/g, 'Simulados por Upload');
  content = content.replace(/Prova por Upload/g, 'Simulado por Upload');
  content = content.replace(/Provas via Upload/g, 'Simulados via Upload');
  content = content.replace(/Nova Prova/g, 'Novo Simulado');
  content = content.replace(/nova prova/g, 'novo simulado');
  content = content.replace(/uma prova/g, 'um simulado');
  content = content.replace(/Uma prova/g, 'Um simulado');
  content = content.replace(/da prova/g, 'do simulado');
  content = content.replace(/Da prova/g, 'Do simulado');
  content = content.replace(/na prova/g, 'no simulado');
  content = content.replace(/Na prova/g, 'No simulado');
  content = content.replace(/esta prova/g, 'este simulado');
  content = content.replace(/Esta prova/g, 'Este simulado');
  content = content.replace(/dessa prova/g, 'desse simulado');
  content = content.replace(/prova\?/g, 'simulado?');
  content = content.replace(/Total de Provas/g, 'Total de Simulados');
  content = content.replace(/prova/g, 'simulado'); // Be careful with lowercase
  content = content.replace(/Prova/g, 'Simulado'); // Be careful with uppercase

  fs.writeFileSync(filePath, content);
}
console.log('Update complete');
