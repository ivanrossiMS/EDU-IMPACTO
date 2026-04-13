-- ================================================================
-- IMPACTO EDU — Schema v2 (Migração do LocalStorage para Supabase)
-- ================================================================

-- ─── TRANSFERÊNCIAS ──────────────────────────────────────────────
create table if not exists public.transferencias (
  id text primary key,
  aluno_id text,
  aluno_nome text,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.transferencias disable row level security;

-- ─── UNIDADES FISCAIS ───────────────────────────────────────────
create table if not exists public.unidades_fiscais (
  id text primary key,
  cnpj text,
  nome text,
  dados jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.unidades_fiscais disable row level security;

-- ─── NOTAS FISCAIS ──────────────────────────────────────────────
create table if not exists public.notas_fiscais (
  id text primary key,
  numero text,
  unidade_id text,
  aluno text,
  status text,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.notas_fiscais disable row level security;

-- ─── PERFIS (Controle de Acesso) ────────────────────────────────
create table if not exists public.perfis (
  id text primary key,
  nome text,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.perfis disable row level security;

-- ─── ACADÊMICO E INTERAÇÃO ──────────────────────────────────────
create table if not exists public.autorizacoes (
  id text primary key,
  titulo text,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.autorizacoes disable row level security;

create table if not exists public.momentos (
  id text primary key,
  titulo text,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.momentos disable row level security;

create table if not exists public.enquetes (
  id text primary key,
  titulo text,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.enquetes disable row level security;

-- ─── CENSO ESCOLAR ──────────────────────────────────────────────
create table if not exists public.censo_pendencias (
  id text primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.censo_pendencias disable row level security;

create table if not exists public.censo_exports (
  id text primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.censo_exports disable row level security;

create table if not exists public.censo_audit_logs (
  id text primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.censo_audit_logs disable row level security;

create table if not exists public.censo_operacoes (
  id text primary key,
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.censo_operacoes disable row level security;

create table if not exists public.censo_escola_data (
  id text primary key,
  tipo text, -- 'aluno', 'turma', 'profissional'
  dados jsonb not null default '{}',
  created_at timestamptz default now()
);
alter table public.censo_escola_data disable row level security;
