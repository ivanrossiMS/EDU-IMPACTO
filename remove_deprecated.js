const fs = require('fs');

const backupFile = 'components/configuracoes/BackupSection.tsx';
let content = fs.readFileSync(backupFile, 'utf8');

// Remove the hooks
content = content.replace(/const \[agendamentos = \[\]\] = useSupabaseArray<any>\('agendamentos'\)\n/g, '');
content = content.replace(/const \[fornecedores = \[\]\] = useSupabaseArray<any>\('fornecedores'\)\n/g, '');

// Remove from categories items
content = content.replace(/.*\{ label: 'Agendamentos', count: agendamentos\.length, data: agendamentos, sheetName: 'CRM-Agendamentos' \},?\n/g, '');
content = content.replace(/.*\{ label: 'Fornecedores', count: fornecedores\.length, data: fornecedores, sheetName: 'Fornecedores' \},?\n/g, '');

// Remove from useMemo dependency array
content = content.replace(/agendamentos, /g, '');
content = content.replace(/fornecedores, /g, '');

// The useMemo array might look like `leads, agendamentos,` which becomes `leads, ` if we remove `agendamentos, `
// Let's just fix trailing commas or spaces if they are left.

fs.writeFileSync(backupFile, content);
console.log('Removed deprecated tables from BackupSection');

const testDataFile = 'components/configuracoes/TestDataSection.tsx';
if (fs.existsSync(testDataFile)) {
    let content2 = fs.readFileSync(testDataFile, 'utf8');
    content2 = content2.replace(/const \[agendamentos = \[\], setAgendamentos\] = useSupabaseArray<any>\('agendamentos'\)\n/g, '');
    content2 = content2.replace(/const \[fornecedores = \[\], setFornecedores\] = useSupabaseArray<any>\('fornecedores'\)\n/g, '');
    fs.writeFileSync(testDataFile, content2);
    console.log('Removed from TestDataSection');
}

