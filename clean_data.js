const fs = require('fs');

let content = fs.readFileSync('lib/dataContext.tsx', 'utf8');
const lines = content.split('\n');

const newLines = lines.filter(line => {
    if (line.includes('agendamentos: \'edu-data-agendamentos\',')) return false;
    if (line.includes('fornecedoresCad: \'edu-op-fornecedores\',')) return false;
    if (line.includes('agendamentos: Agendamento[]; setAgendamentos: Setter<Agendamento[]>')) return false;
    if (line.includes('fornecedoresCad: FornecedorCad[]; setFornecedoresCad: Setter<FornecedorCad[]>')) return false;
    if (line.includes('agendamentos: [], setAgendamentos: NOOP,')) return false;
    if (line.includes('fornecedoresCad: [], setFornecedoresCad: NOOP,')) return false;
    if (line.includes('const [agendamentos, setAgendamentos] = useSupabaseArray<Agendamento>(\'agendamentos\')')) return false;
    if (line.includes('const [fornecedoresCad, setFornecedoresCad] = useSupabaseArray<FornecedorCad>(\'fornecedores\')')) return false;
    if (line.includes('agendamentos, ...{ setAgendamentos: trackedSetters.setAgendamentos },')) return false;
    if (line.includes('fornecedoresCad, ...{ setFornecedoresCad: trackedSetters.setFornecedoresCad },')) return false;
    return true;
});

let finalContent = newLines.join('\n');
// Also fix useMemo dependency arrays:
finalContent = finalContent.replace(/turmas, leads, agendamentos, comunicados, tarefas, mantenedores,/g, 'turmas, leads, comunicados, tarefas, mantenedores,');
finalContent = finalContent.replace(/cfgCalendarioLetivo, movimentacoesManuais, fornecedoresCad,/g, 'cfgCalendarioLetivo, movimentacoesManuais,');

fs.writeFileSync('lib/dataContext.tsx', finalContent);

let mockContent = fs.readFileSync('lib/mockDb.ts', 'utf8');
const mockLines = mockContent.split('\n').filter(l => !l.includes('agendamentos: [] as any[],') && !l.includes('fornecedores: [] as any[],'));
fs.writeFileSync('lib/mockDb.ts', mockLines.join('\n'));

console.log('Cleaned securely');
