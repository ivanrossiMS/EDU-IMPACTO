const fs = require('fs');

const adminFile = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/admin/comunicados/page.tsx';
const colabFile = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/colaborador/comunicados/page.tsx';

const adminContent = fs.readFileSync(adminFile, 'utf8');
const colabContent = fs.readFileSync(colabFile, 'utf8');

// Extrair a partir do comentário {/* Modal Composer */} até o Modal de Visualização
const modalStartIdx = adminContent.indexOf('{/* Modal Composer */}');
const modalEndIdx = adminContent.indexOf('{/* View Communication Modal */}');

if (modalStartIdx === -1 || modalEndIdx === -1) {
  console.log("Modals not found in Admin file.");
  process.exit(1);
}

// Extrair a string
let modalsBlock = adminContent.substring(modalStartIdx, modalEndIdx);
// Fix the fact that View Communication Modal starts with <AnimatePresence> usually.
// Let's just find "      <AnimatePresence>\n        {/* View Communication Modal */}"
const exactEnd = adminContent.indexOf('<AnimatePresence>\n        {/* View Communication Modal */}');
if (exactEnd !== -1 && exactEnd > modalStartIdx) {
  modalsBlock = adminContent.substring(modalStartIdx, exactEnd);
}

// Now replace the legacy composer block in colabFile
// It starts with `{showComposer ? (` around line 471 and ends with `) : (` around 639
const startToken = '{showComposer ? (';
const endToken = ') : (\n          <>\n        <AnimatePresence>';

let newColab = colabContent.replace(
  new RegExp('\\{\\s*showComposer \\? \\([\\s\\S]*?\\)\\s*:\\s*\\(\\s*<>\\s*<AnimatePresence>'),
  '<AnimatePresence>'
);

// Delete the trailing `)}` that matched `showComposer ? (`
// It is right before `</div>\n      <style jsx global>{`
newColab = newColab.replace(
  /<\/AnimatePresence>\n\s*<\/>\n\s*\)}\n\s*<\/div>\n\s*<style jsx global>/,
  '</AnimatePresence>\n\n' + modalsBlock + '\n      </div>\n      <style jsx global>'
);

// We should also ensure the `)}` removal if it was just `      )}\n      </div>\n      <style jsx global>{`
newColab = newColab.replace(
  /<\/AnimatePresence>\n\s*<\/>\n\s*\)}\n\s*<\/div>/,
  '</AnimatePresence>\n\n' + modalsBlock + '\n      </div>'
);

fs.writeFileSync(colabFile, newColab);
console.log("Updated Colaborador file successfully.");

