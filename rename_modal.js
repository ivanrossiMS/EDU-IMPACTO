import fs from 'fs';

const file = 'components/simulados/ProvaQuestaoFormModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Database tables
content = content.replace(/from\('simulados'\)/g, "from('provas')");
content = content.replace(/from\('simulados_requisicoes'\)/g, "from('provas_requisicoes')");
content = content.replace(/from\('simulados_questoes'\)/g, "from('provas_questoes')");
content = content.replace(/from\('simulados_alternativas'\)/g, "from('provas_alternativas')");

// IDs and variables
content = content.replace(/id_simulado/g, 'id_prova');
content = content.replace(/simuladoId/g, 'provaId');

// Replace words while keeping case
content = content.replace(/\bSimulado\b/g, 'Prova');
content = content.replace(/\bsimulado\b/g, 'prova');

// Component name
content = content.replace(/QuestaoFormModal/g, 'ProvaQuestaoFormModal');

fs.writeFileSync(file, content);
console.log("Done");
