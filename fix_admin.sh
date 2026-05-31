cat << 'JS_EOF' > refactor_admin_final.js
const fs = require('fs');

let code = fs.readFileSync('app/agenda-digital/admin/comunicados/page.tsx', 'utf8');

// 1. Add import
code = code.replace(
  "import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'",
  "import { DestinatariosModal } from '@/components/agenda/DestinatariosModal'\nimport NovoComunicadoModal from '../../components/agenda/NovoComunicadoModal'"
);

// 2. Remove state declarations carefully
code = code.replace(/const \[newTitulo, setNewTitulo\] = useState\(''\)\n?/g, '');
code = code.replace(/const \[newConteudo, setNewConteudo\] = useState\(''\)\n?/g, '');
code = code.replace(/const \[anexos, setAnexos\] = useState<any\[\]>\(\[\]\)\n?/g, '');
code = code.replace(/const \[dataAgendamento, setDataAgendamento\] = useState<string>\(''\)\n?/g, '');
code = code.replace(/const \[tempDataAgendamento, setTempDataAgendamento\] = useState\(''\)\n?/g, '');
code = code.replace(/const \[isUploading, setIsUploading\] = useState\(false\)\n?/g, '');
code = code.replace(/const \[uploadProgress, setUploadProgress\] = useState\(0\)\n?/g, '');
code = code.replace(/const comunicadoRichEditorRef = useRef<HTMLDivElement>\(null\)\n?/g, '');
code = code.replace(/const \[showScheduleModal, setShowScheduleModal\] = useState\(false\)\n?/g, '');

// 3. Remove useEffect
code = code.replace(/\/\/ Sync editor content only on showComposer.*?\}, \[showComposer\]\);\n/gs, '');
code = code.replace(/\/\/ Sync editor content only on showComposer.*?\}, \[showComposer, editComId\]\);\n/gs, '');

// 4. Update handleEnviar
code = code.replace('const handleEnviar = (asRascunho = false) => {', 'const handleEnviar = (data: any, asRascunho = false) => {\n    const { titulo, conteudo, anexos, dataAgendamento } = data;\n    const newTitulo = titulo;\n    const newConteudo = conteudo;');

// 5. Update openEdit / handleReenviar / handleNovo
code = code.replace(/setNewTitulo\(.*?\)/g, '');
code = code.replace(/setNewConteudo\(.*?\)/g, '');
code = code.replace(/setAnexos\(.*?\)/g, '');
code = code.replace(/setDataAgendamento\(.*?\)/g, '');
code = code.replace(/setTempDataAgendamento\(.*?\)/g, '');
code = code.replace(/if \(comunicadoRichEditorRef\.current\) .*?\n/g, '');

// 6. Fix TS implicit any in handleEnviar
code = code.replace(/appendedForms\.forEach\(formName => \{/g, "appendedForms.forEach((formName: string) => {");
code = code.replace(/anexos\.filter\(a => a\.startsWith\('Formulário: '\)\)\.map\(a =>/g, "anexos.filter((a: any) => a.startsWith('Formulário: ')).map((a: any) =>");

// 7. Replace the JSX Modal Composer with the new component
const startIdx = code.indexOf('{/* Modal Composer */}');
const endIdx = code.indexOf('{/* Destinatarios Universal Modal */}');

if (startIdx > -1 && endIdx > -1) {
  const newComponent = `
      {/* Modal Composer */}
      <NovoComunicadoModal
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        initialData={editComId ? comunicados.find(c => c.id === editComId) : null}
        currentUser={currentUser}
        selectedDest={selectedDest}
        onClickSelectDest={() => setShowDestModal(true)}
        onRemoveDest={id => setSelectedDest(prev => prev.filter(x => x.id !== id))}
        onSave={(data, isDraft) => handleEnviar(data, isDraft)}
      />

      `;
  code = code.substring(0, startIdx) + newComponent + code.substring(endIdx);
}

// 8. Remove the Schedule Modal cleanly
const scheduleIdx = code.indexOf('{/* Modal de Agendamento */}');
if (scheduleIdx > -1) {
  const endSchedule = code.indexOf('</AnimatePresence>', scheduleIdx);
  if (endSchedule > -1) {
    code = code.substring(0, scheduleIdx) + code.substring(endSchedule + 18);
  }
}

// 9. Fix onAdd for ReportsSelectionModal and FormsSelectionModal
code = code.replace(/onAdd=\{\(text, payload\) => \}\S*?\]\)\}/g, "onAdd={(text, payload) => alert('Adicione o relatório anexando o PDF gerado ou insira o link.')}");
code = code.replace(/onAdd=\{\(text, id\) => \}\S*?\]\)\}/g, "onAdd={(text, id) => alert('A funcionalidade de formulário direto foi movida.')}");
code = code.replace(/onAdd=\{\(res\) => \}\S*?\]\)\}/g, "onAdd={(res) => alert('Use o botão de anexar arquivos.')}");
// also fix `|report-payload\`])}` etc
code = code.replace(/\|report-payload`\]\)\}/g, "");

fs.writeFileSync('app/agenda-digital/admin/comunicados/page.tsx', code);
JS_EOF

git checkout app/agenda-digital/admin/comunicados/page.tsx
node refactor_admin_final.js
