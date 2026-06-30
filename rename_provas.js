import fs from 'fs';
import path from 'path';

function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const files = walkSync('app/(app)/provas');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Database tables
  content = content.replace(/from\('simulados'\)/g, "from('provas')");
  content = content.replace(/from\('simulados_requisicoes'\)/g, "from('provas_requisicoes')");
  content = content.replace(/from\('simulados_questoes'\)/g, "from('provas_questoes')");
  content = content.replace(/from\('simulados_alternativas'\)/g, "from('provas_alternativas')");
  
  // URLs
  content = content.replace(/\/simulados\/gerenciamento/g, '/simulados/provas/gerenciamento');
  content = content.replace(/\/simulados\/lista/g, '/simulados/provas/lista');

  // IDs and variables
  content = content.replace(/id_simulado/g, 'id_prova');
  content = content.replace(/simuladoId/g, 'provaId');
  
  // Replace words while keeping case
  content = content.replace(/\bSimulado\b/g, 'Prova');
  content = content.replace(/\bsimulado\b/g, 'prova');
  content = content.replace(/\bSimulados\b/g, 'Provas');
  content = content.replace(/\bsimulados\b/g, 'provas');

  // Component names
  content = content.replace(/QuestaoFormModal/g, 'ProvaQuestaoFormModal');

  fs.writeFileSync(file, content);
});
console.log("Done replacing in", files.length, "files");
