const fs = require('fs');
const SidebarPath = 'c:/Users/ivanr/OneDrive/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/components/layout/Sidebar.tsx';
const content = fs.readFileSync(SidebarPath, 'utf8');
const toSlug = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');

const modRegex = /title:\s*'([^']+)'/g;
let mods = [];
let match;
while ((match = modRegex.exec(content)) !== null) { mods.push(toSlug(match[1])); }
const hrefRegex = /href:\s*'([^']+)'/g;
while ((match = hrefRegex.exec(content)) !== null) { mods.push(match[1]); }
const allKeys = Array.from(new Set(mods));

const academicoKeys = ['academico', ...allKeys.filter(k => k.startsWith('/academico') || k.startsWith('/secretaria'))];
const rhKeys = ['rh', ...allKeys.filter(k => k.startsWith('/rh'))];
const financeiroKeys = ['financeiro', ...allKeys.filter(k => k.startsWith('/financeiro'))];
const crmKeys = ['crm', ...allKeys.filter(k => k.startsWith('/crm'))];
const adminKeys = ['administrativo', ...allKeys.filter(k => k.startsWith('/administrativo') || k.startsWith('/configuracoes/pedagogico') || k.startsWith('/configuracoes/financeiro'))];
const portariaKeys = ['portaria', ...allKeys.filter(k => k.startsWith('/saida-alunos') || k === '/painel-tablet')];
const dashboardKeys = ['dashboard', '/dashboard', '/alertas', '/tarefas', '/calendario', 'principal'];
const relatorioKeys = ['relatorios', ...allKeys.filter(k => k.startsWith('/relatorios') || k.startsWith('/bi'))];

const coordKeys = Array.from(new Set([...dashboardKeys, ...academicoKeys, ...rhKeys]));
const secKeys = Array.from(new Set([...dashboardKeys, ...academicoKeys]));
const profKeys = Array.from(new Set([...dashboardKeys, 'academico', '/academico/frequencia', '/academico/notas', '/academico/ocorrencias', '/academico/grade']));
const finKeys = Array.from(new Set([...dashboardKeys, ...financeiroKeys, ...relatorioKeys]));
const portKeys = Array.from(new Set([...dashboardKeys, ...portariaKeys]));

const targetCode = `export const DEFAULT_PERFIS: Perfil[] = [
  { id: 'P1', nome: 'Diretor Geral', cor: '#ef4444', descricao: 'Acesso total ao sistema', permissoes: ${JSON.stringify(allKeys).replace(/"/g, "'")} },
  { id: 'P2', nome: 'Coordenador', cor: '#f59e0b', descricao: 'Área pedagógica e RH', permissoes: ${JSON.stringify(coordKeys).replace(/"/g, "'")} },
  { id: 'P3', nome: 'Secretária', cor: '#3b82f6', descricao: 'Secretaria e acadêmico', permissoes: ${JSON.stringify(secKeys).replace(/"/g, "'")} },
  { id: 'P4', nome: 'Professor', cor: '#10b981', descricao: 'Diário, notas e frequência', permissoes: ${JSON.stringify(profKeys).replace(/"/g, "'")} },
  { id: 'P5', nome: 'Financeiro', cor: '#8b5cf6', descricao: 'Módulo financeiro e relatórios', permissoes: ${JSON.stringify(finKeys).replace(/"/g, "'")} },
  { id: 'P6', nome: 'Portaria & Segurança', cor: '#64748b', descricao: 'Controle de acesso e saída', permissoes: ${JSON.stringify(portKeys).replace(/"/g, "'")} },
]`;

const ctxPath = 'c:/Users/ivanr/OneDrive/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/lib/dataContext.tsx';
let ctx = fs.readFileSync(ctxPath, 'utf8');

// Replace everything between export const DEFAULT_PERFIS: Perfil[] = [ ... ]
ctx = ctx.replace(/export const DEFAULT_PERFIS: Perfil\[\] = \[\s*\{ id: 'P1'.*?\]\n/s, targetCode + '\n');
fs.writeFileSync(ctxPath, ctx);

console.log("Successfully updated DEFAULT_PERFIS in dataContext.tsx");
