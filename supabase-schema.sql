-- ================================================================
-- IMPACTO EDU — Schema Completo para Supabase
-- Execute este SQL no Supabase → SQL Editor → New Query → Run
-- ================================================================

-- Habilitar UUID
create extension if not exists "pgcrypto";

-- ─── ALUNOS ────────────────────────────────────────────────────────
create table if not exists public.alunos (
  id text primary key,
  nome text not null,
  matricula text,
  turma text default '',
  serie text default '',
  turno text default '',
  status text default 'matriculado',
  email text default '',
  cpf text default '',
  data_nascimento text default '',
  responsavel text default '',
  responsavel_financeiro text default '',
  responsavel_pedagogico text default '',
  telefone text default '',
  inadimplente boolean default false,
  risco_evasao text default 'baixo',
  media numeric,
  frequencia numeric default 100,
  obs text default '',
  unidade text default 'Unidade Centro',
  foto text,
  -- dados completos em JSON para responsáveis, matrículas, parcelas
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TURMAS ───────────────────────────────────────────────────────
create table if not exists public.turmas (
  id text primary key,
  codigo text default '',
  nome text not null,
  serie text default '',
  turno text default '',
  professor text default '',
  sala text default '',
  capacidade integer default 30,
  matriculados integer default 0,
  unidade text default '',
  ano integer default extract(year from now())::integer,
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TÍTULOS (Contas a Receber) ────────────────────────────────────
create table if not exists public.titulos (
  id text primary key,
  codigo text default '',
  aluno text default '',
  aluno_id text default '',
  responsavel text default '',
  descricao text default '',
  valor numeric not null default 0,
  vencimento text default '',
  pagamento text,
  status text default 'pendente', -- pago | pendente | atrasado
  metodo text,
  parcela text default '',
  turma text default '',
  ano integer,
  evento_id text default '',
  evento_descricao text default '',
  -- campos bancários em jsonb
  dados_bancarios jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── CONTAS A PAGAR ───────────────────────────────────────────────
create table if not exists public.contas_pagar (
  id text primary key,
  codigo text default '',
  descricao text not null,
  categoria text default '',
  valor numeric not null default 0,
  vencimento text default '',
  status text default 'pendente', -- pago | pendente
  fornecedor text default '',
  numero_documento text default '',
  plano_contas_id text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── FUNCIONÁRIOS ─────────────────────────────────────────────────
create table if not exists public.funcionarios (
  id text primary key,
  nome text not null,
  cargo text default '',
  departamento text default '',
  salario numeric default 0,
  status text default 'ativo',
  email text default '',
  admissao text default '',
  unidade text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── LEADS (CRM) ──────────────────────────────────────────────────
create table if not exists public.leads (
  id text primary key,
  nome text not null,
  interesse text default '',
  origem text default '',
  status text default 'novo',
  responsavel text default '',
  data text default '',
  telefone text default '',
  email text default '',
  score_ia numeric default 0,
  valor_potencial numeric default 0,
  notas text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── AGENDAMENTOS (CRM) ───────────────────────────────────────────
create table if not exists public.agendamentos (
  id text primary key,
  lead text default '',
  tipo text default '',
  data text default '',
  hora text default '',
  responsavel text default '',
  status text default 'agendado',
  notas text default '',
  dados jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── COMUNICADOS ──────────────────────────────────────────────────
create table if not exists public.comunicados (
  id text primary key,
  titulo text not null,
  texto text default '',
  autor text default '',
  data text default '',
  destino text default 'Todos',
  fixado boolean default false,
  dados jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── TAREFAS ──────────────────────────────────────────────────────
create table if not exists public.tarefas (
  id text primary key,
  titulo text not null,
  descricao text default '',
  responsavel text default '',
  prazo text default '',
  status text default 'pendente',
  prioridade text default 'media',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── OCORRÊNCIAS ──────────────────────────────────────────────────
create table if not exists public.ocorrencias (
  id text primary key,
  aluno_id text default '',
  aluno_nome text default '',
  turma text default '',
  tipo text default '',
  descricao text default '',
  gravidade text default 'leve',
  data text default '',
  responsavel text default '',
  ciencia_responsavel boolean default false,
  dados jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── FREQUÊNCIAS ──────────────────────────────────────────────────
create table if not exists public.frequencias (
  id text primary key,
  turma_id text not null,
  data text not null,
  registros jsonb default '[]', -- [{alunoId, status}]
  criado_por text default '',
  created_at timestamptz default now()
);

-- ─── LANÇAMENTOS DE NOTA ──────────────────────────────────────────
create table if not exists public.lancamentos_nota (
  id text primary key,
  turma_id text not null,
  disciplina text default '',
  bimestre integer default 1,
  notas jsonb default '[]', -- [{alunoId, n1, n2, n3, media}]
  criado_por text default '',
  created_at timestamptz default now()
);

-- ─── ROTINA (Grade Horária) ───────────────────────────────────────
create table if not exists public.rotina_items (
  id text primary key,
  turma text default '',
  dia_semana integer default 1, -- 0=DOM, 1=SEG... 6=SAB
  hora_inicio text default '',
  hora_fim text default '',
  disciplina text default '',
  professor text default '',
  sala text default '',
  tipo text default 'aula',
  cor text default '#3b82f6',
  created_at timestamptz default now()
);

-- ─── EVENTOS DA AGENDA ────────────────────────────────────────────
create table if not exists public.eventos_agenda (
  id text primary key,
  titulo text not null,
  descricao text default '',
  tipo text default 'evento',
  data text default '',
  hora_inicio text default '',
  hora_fim text default '',
  turmas jsonb default '[]',
  local text default '',
  cor text default '#3b82f6',
  recorrente boolean default false,
  criado_por text default '',
  unidade text default '',
  dados jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── MANTENEDORES ────────────────────────────────────────────────
create table if not exists public.mantenedores (
  id text primary key,
  dados jsonb not null default '{}', -- schema completo em JSONB
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── LOGS DO SISTEMA ─────────────────────────────────────────────
create table if not exists public.system_logs (
  id text primary key,
  data_hora text not null,
  usuario_nome text default 'Admin',
  perfil text default 'admin',
  modulo text default '',
  acao text not null,
  registro_id text,
  nome_relacionado text,
  descricao text default '',
  status text default 'sucesso',
  ip text,
  origem text default 'sistema',
  detalhes_antes jsonb,
  detalhes_depois jsonb,
  created_at timestamptz default now()
);

-- ─── MOVIMENTAÇÕES MANUAIS ────────────────────────────────────────
create table if not exists public.movimentacoes (
  id text primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ─── CAIXAS ──────────────────────────────────────────────────────
create table if not exists public.caixas (
  id text primary key,
  dados jsonb not null default '{}',
  fechado boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── FORNECEDORES ────────────────────────────────────────────────
create table if not exists public.fornecedores (
  id text primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ADIANTAMENTOS RH ────────────────────────────────────────────
create table if not exists public.adiantamentos (
  id text primary key,
  funcionario_id text default '',
  funcionario_nome text default '',
  dados jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ADVERTÊNCIAS RH ────────────────────────────────────────────
create table if not exists public.advertencias (
  id text primary key,
  funcionario_id text default '',
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ─── CONFIGURAÇÕES (chave-valor universal) ────────────────────────
-- Uma tabela para cfgDisciplinas, cfgCentrosCusto, cfgPadroesPagamento,
-- cfgConvenios, cfgPlanoContas, etc.
create table if not exists public.configuracoes (
  chave text primary key,
  valor jsonb not null default '[]',
  updated_at timestamptz default now()
);

-- ─── RLS: Desativar por enquanto (app single-tenant sem auth) ──────
-- Para produção com múltiplos usuários, habilitar RLS e criar policies.
alter table public.alunos disable row level security;
alter table public.turmas disable row level security;
alter table public.titulos disable row level security;
alter table public.contas_pagar disable row level security;
alter table public.funcionarios disable row level security;
alter table public.leads disable row level security;
alter table public.agendamentos disable row level security;
alter table public.comunicados disable row level security;
alter table public.tarefas disable row level security;
alter table public.ocorrencias disable row level security;
alter table public.frequencias disable row level security;
alter table public.lancamentos_nota disable row level security;
alter table public.rotina_items disable row level security;
alter table public.eventos_agenda disable row level security;
alter table public.mantenedores disable row level security;
alter table public.system_logs disable row level security;
alter table public.movimentacoes disable row level security;
alter table public.caixas disable row level security;
alter table public.fornecedores disable row level security;
alter table public.adiantamentos disable row level security;
alter table public.advertencias disable row level security;
alter table public.configuracoes disable row level security;

-- ─── INDEXES para performance ─────────────────────────────────────
create index if not exists idx_alunos_nome on public.alunos(nome);
create index if not exists idx_alunos_status on public.alunos(status);
create index if not exists idx_titulos_status on public.titulos(status);
create index if not exists idx_titulos_vencimento on public.titulos(vencimento);
create index if not exists idx_titulos_aluno_id on public.titulos(aluno_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_system_logs_data on public.system_logs(data_hora desc);
create index if not exists idx_frequencias_turma on public.frequencias(turma_id);
create index if not exists idx_lancamentos_turma on public.lancamentos_nota(turma_id);
-- --- SYSTEM USERS --------------------------------------------------
create table if not exists public.system_users (
  id text primary key,
  nome text not null,
  email text not null,
  cargo text default '',
  perfil text default '',
  status text default 'ativo',
  twofa boolean default false,
  ultimoAcesso text default 'Nunca',
  senha text default '',
  dados jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.system_users disable row level security;
