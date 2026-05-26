const fs = require('fs');

const files = [
  'app/agenda-digital/colaborador/calendario/page.tsx',
  'app/agenda-digital/colaborador/comunicados/page.tsx',
  'app/agenda-digital/colaborador/conversas/page.tsx',
  'app/agenda-digital/colaborador/frequencia/page.tsx',
  'app/agenda-digital/colaborador/momentos/page.tsx',
  'app/agenda-digital/colaborador/notas/page.tsx',
  'app/agenda-digital/colaborador/ocorrencias/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Add import if not exists
  if (!content.includes('TurmaDropdown')) {
    // Find last import
    const lastImportIndex = content.lastIndexOf('import ');
    const newlineIndex = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, newlineIndex) + "\nimport { TurmaDropdown } from '../components/TurmaDropdown'\n" + content.slice(newlineIndex);
  }

  // Replace <select> block
  const selectRegex = /<select[\s\S]*?value=\{selectedTurmaId\}[\s\S]*?<\/select>/;
  if (selectRegex.test(content)) {
    content = content.replace(selectRegex, `<TurmaDropdown 
              turmaOptions={turmaOptions} 
              selectedTurmaId={selectedTurmaId} 
              setSelectedTurmaId={setSelectedTurmaId} 
              selectedTurmaName={selectedTurmaName} 
            />`);
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  } else {
    // maybe it has <select className="form-input" ...
    console.log('No <select> matched in ' + file);
  }
}
