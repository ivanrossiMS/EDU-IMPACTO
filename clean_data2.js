const fs = require('fs');

let content = fs.readFileSync('lib/dataContext.tsx', 'utf8');

// 1. Remove the properties from the DataState type
content = content.replace(/agendamentos: Agendamento\[\]; setAgendamentos: Setter<Agendamento\[\]>/g, '');
content = content.replace(/fornecedoresCad: FornecedorCad\[\]; setFornecedoresCad: Setter<FornecedorCad\[\]>/g, '');

// 2. Remove from INITIAL_STATE
content = content.replace(/agendamentos: \[\], setAgendamentos: NOOP,/g, '');
content = content.replace(/fornecedoresCad: \[\], setFornecedoresCad: NOOP,/g, '');

// 3. Remove the hooks
content = content.replace(/const \[agendamentos, setAgendamentos\] = useSupabaseArray<Agendamento>\('agendamentos'\)/g, '');
content = content.replace(/const \[fornecedoresCad, setFornecedoresCad\] = useSupabaseArray<FornecedorCad>\('fornecedores'\)/g, '');

// 4. Remove from useMemo object literal (trackedSetters)
content = content.replace(/agendamentos, \.\.\.\{ setAgendamentos: trackedSetters\.setAgendamentos \},/g, '');
content = content.replace(/fornecedoresCad, \.\.\.\{ setFornecedoresCad: trackedSetters\.setFornecedoresCad \},/g, '');

// 5. Remove from trackedSetters definition (if any leftover inside useMemo array)
content = content.replace(/turmas, leads, agendamentos, comunicados, tarefas, mantenedores,/g, 'turmas, leads, comunicados, tarefas, mantenedores,');
content = content.replace(/cfgCalendarioLetivo, movimentacoesManuais, fornecedoresCad,/g, 'cfgCalendarioLetivo, movimentacoesManuais,');

fs.writeFileSync('lib/dataContext.tsx', content);
console.log('Cleaned context cleanly');

