const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const appDir = 'c:/Users/ivanr/OneDrive/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app';
const files = getAllFiles(appDir, []);

let changed = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf-8');
  let orig = content;

  // Substituir "Matrícula: " por "Cód. Sist.: " ou similares se for rótulo
  // Procurar por {aluno.matricula} se estiver preceiddo por Mat ou Matrícula
  content = content.replace(/Matrícula:/g, 'Código:');
  content = content.replace(/Mat\./g, 'Cód.');
  content = content.replace(/Matríc\./g, 'Cód.');
  content = content.replace(/Matrícula /g, 'Código ');
  content = content.replace(/Matrícula;/g, 'Código;');
  content = content.replace(/Matrícula /g, 'Código ');

  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf-8');
    changed++;
  }
});

console.log("Changed " + changed + " files for Matrícula.");
