const fs = require('fs');
const filePath = 'impacto-edu-app/lib/dataContext.tsx';

let content = fs.readFileSync(filePath, 'utf8');

// 1. Interfaces
const interfaces = `
export interface ConfigTurno {
  id: string
  codigo: string
  nome: string
  horarioInicio: string
  horarioFim: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigSituacaoAluno {
  id: string
  codigo: string
  nome: string // ex: Cursando, Aprovado
  tipo: 'Ativo' | 'Inativo' | 'Historico' | 'Transferido' | 'Cancelado'
  situacao: 'ativo' | 'inativo'
  createdAt: string
}

export interface ConfigGrupoAluno {
  id: string
  codigo: string
  nome: string // ex: Turma de Reforço, Atletas
  descricao: string
  situacao: 'ativo' | 'inativo'
  createdAt: string
}
`;

if (!content.includes('ConfigTurno')) {
  // Insert before ConfigDisciplina
  const searchStr = 'export interface ConfigDisciplina {';
  const idx = content.indexOf(searchStr);
  if (idx !== -1) {
    content = content.slice(0, idx) + interfaces + '\n' + content.slice(idx);
  }
}

// 2. KEYS
const newKeys = `  // Novas Configs
  cfgTurnos: 'edu-cfg-turnos',
  cfgSituacaoAluno: 'edu-cfg-situacao-aluno',
  cfgGruposAlunos: 'edu-cfg-grupos-alunos',`;

if (!content.includes('cfgTurnos:')) {
  const searchStrKeys = 'cfgDisciplinas:';
  const idxKeys = content.indexOf(searchStrKeys);
  if (idxKeys !== -1) {
    content = content.slice(0, idxKeys) + newKeys + '\n  ' + content.slice(idxKeys);
  }
}

// 3. Defaults
const defaults = `
const TURNOS_DEFAULT: ConfigTurno[] = [
  { id: 'T1', codigo: 'MN', nome: 'Manhã', horarioInicio: '07:00', horarioFim: '12:00', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T2', codigo: 'TD', nome: 'Tarde', horarioInicio: '13:00', horarioFim: '18:00', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T3', codigo: 'NT', nome: 'Noite', horarioInicio: '19:00', horarioFim: '22:30', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T4', codigo: 'IN', nome: 'Intermediário', horarioInicio: '10:00', horarioFim: '15:00', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'T5', codigo: 'IG', nome: 'Integral', horarioInicio: '08:00', horarioFim: '17:00', situacao: 'ativo', createdAt: new Date().toISOString() },
]

const SITUACOES_DEFAULT: ConfigSituacaoAluno[] = [
  { id: 'S1', codigo: 'APR', nome: 'Aprovado', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S2', codigo: 'APP', nome: 'Aprovado com P/P', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S3', codigo: 'CON', nome: 'Concluído', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S4', codigo: 'CUR', nome: 'Cursando', tipo: 'Ativo', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S5', codigo: 'DES', nome: 'Desistente', tipo: 'Inativo', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S6', codigo: 'CAN', nome: 'Matrícula cancelada', tipo: 'Cancelado', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S7', codigo: 'TRA', nome: 'Matrícula trancada', tipo: 'Inativo', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S8', codigo: 'REM', nome: 'Remanejado', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S9', codigo: 'REP', nome: 'Reprovado', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S10', codigo: 'RPF', nome: 'Reprovado por falta', tipo: 'Historico', situacao: 'ativo', createdAt: new Date().toISOString() },
  { id: 'S11', codigo: 'TRF', nome: 'Transferido', tipo: 'Transferido', situacao: 'ativo', createdAt: new Date().toISOString() },
]
`;

if (!content.includes('TURNOS_DEFAULT')) {
  // Insert before DataState interface
  const searchStrDefs = 'interface DataState {';
  const idxDefs = content.indexOf(searchStrDefs);
  if (idxDefs !== -1) {
    content = content.slice(0, idxDefs) + defaults + '\n' + content.slice(idxDefs);
  }
}

// 4. DataState interface
const stateLines = `  cfgTurnos: ConfigTurno[]; setCfgTurnos: Setter<ConfigTurno[]>
  cfgSituacaoAluno: ConfigSituacaoAluno[]; setCfgSituacaoAluno: Setter<ConfigSituacaoAluno[]>
  cfgGruposAlunos: ConfigGrupoAluno[]; setCfgGruposAlunos: Setter<ConfigGrupoAluno[]>`;

if (!content.includes('setCfgTurnos:')) {
  const searchStrState = 'cfgDisciplinas:';
  const idxState = content.indexOf(searchStrState);
  if (idxState !== -1) {
    content = content.slice(0, idxState) + stateLines + '\n  ' + content.slice(idxState);
  }
}

// 5. useLocalStorage
const hookLines = `  const [cfgTurnos, setCfgTurnos] = useLocalStorage<ConfigTurno[]>(KEYS.cfgTurnos, TURNOS_DEFAULT)
  const [cfgSituacaoAluno, setCfgSituacaoAluno] = useLocalStorage<ConfigSituacaoAluno[]>(KEYS.cfgSituacaoAluno, SITUACOES_DEFAULT)
  const [cfgGruposAlunos, setCfgGruposAlunos] = useLocalStorage<ConfigGrupoAluno[]>(KEYS.cfgGruposAlunos, [])`;

if (!content.includes('[cfgTurnos,')) {
  const searchStrHook = 'const [cfgDisciplinas,';
  const idxHook = content.indexOf(searchStrHook);
  if (idxHook !== -1) {
    content = content.slice(0, idxHook) + hookLines + '\n  ' + content.slice(idxHook);
  }
}

// 6. wipeAll
const wipeReplace = `setCfgTurnos(TURNOS_DEFAULT); setCfgSituacaoAluno(SITUACOES_DEFAULT); setCfgGruposAlunos([]);`;
if (!content.includes('setCfgTurnos(TURNOS_DEFAULT)')) {
  const searchStrWipe = 'setCfgEsquemasAvaliacao([])';
  const idxWipe = content.indexOf(searchStrWipe);
  if (idxWipe !== -1) {
    content = content.slice(0, idxWipe + searchStrWipe.length) + '; ' + wipeReplace + content.slice(idxWipe + searchStrWipe.length);
  }
}

// 7. Context Provider value
const valLines = `      cfgTurnos, setCfgTurnos,
      cfgSituacaoAluno, setCfgSituacaoAluno,
      cfgGruposAlunos, setCfgGruposAlunos,`;

if (!content.includes('cfgTurnos, setCfgTurnos')) {
  const searchStrVal = 'cfgDisciplinas, setCfgDisciplinas,';
  const idxVal = content.indexOf(searchStrVal);
  if (idxVal !== -1) {
    content = content.slice(0, idxVal) + valLines + '\n      ' + content.slice(idxVal);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Context data modifiers successfully added.');
