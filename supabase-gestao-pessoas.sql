-- ================================================================
-- IMPACTO EDU — Schema para Gestão de Pessoas (RH / SST / NR-01)
-- Execute este SQL no Supabase → SQL Editor → New Query → Run
-- ================================================================

-- ─── CARGOS E FUNÇÕES ────────────────────────────────────────────────
create table if not exists public.gp_cargos_funcoes (
  id text primary key,
  nome text not null,
  setor text default '',
  descricao text default '',
  atividades_principais text default '',
  riscos_ocupacionais text default '',
  treinamentos_obrigatorios text default '',
  documentos_obrigatorios text default '',
  epis text default '',
  periodicidade_revisao text default '',
  status text default 'ativo',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── DOCUMENTOS (RH e SST) ───────────────────────────────────────────
create table if not exists public.gp_documentos (
  id text primary key,
  tipo text not null, -- contrato, termo, certificado, aso, pcmso, pgr, etc.
  funcionario_id text, -- pode ser nulo se for doc geral da empresa
  nome text not null,
  url text not null,
  validade text default '',
  responsavel text default '',
  sigilo text default 'normal', -- normal, restrito, confidencial
  tags text default '',
  status text default 'ativo',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TREINAMENTOS ────────────────────────────────────────────────────
create table if not exists public.gp_treinamentos (
  id text primary key,
  nome text not null,
  descricao text default '',
  publico_alvo text default '',
  cargos_obrigatorios text default '',
  periodicidade text default '',
  carga_horaria text default '',
  responsavel text default '',
  validade text default '',
  material_url text default '',
  status text default 'ativo',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── FUNCIONÁRIO <-> TREINAMENTO (Vínculo) ───────────────────────────
create table if not exists public.gp_funcionario_treinamento (
  id text primary key,
  funcionario_id text not null,
  treinamento_id text not null,
  status text default 'pendente', -- pendente, concluido, vencido
  data_conclusao text default '',
  certificado_url text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── INVENTÁRIO DE RISCOS (SST) ──────────────────────────────────────
create table if not exists public.gp_inventario_riscos (
  id text primary key,
  setor text default '',
  cargo_funcao_id text default '',
  atividade text default '',
  perigo_identificado text default '',
  tipo_risco text default '', -- fisico, quimico, biologico, ergonomico, acidente, psicossocial
  fonte_causa text default '',
  possiveis_danos text default '',
  pessoas_expostas text default '',
  medidas_preventivas text default '',
  probabilidade text default '',
  severidade text default '',
  nivel_risco text default '', -- baixo, medio, alto, critico
  prioridade text default 'normal',
  responsavel text default '',
  data_identificacao text default '',
  data_revisao text default '',
  status text default 'ativo',
  evidencias text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── PLANO DE AÇÃO ───────────────────────────────────────────────────
create table if not exists public.gp_plano_acao (
  id text primary key,
  titulo text not null,
  origem text default '',
  risco_id text default '',
  setor text default '',
  responsavel text default '',
  prazo text default '',
  prioridade text default 'normal',
  status text default 'aberta', -- aberta, em andamento, concluida, vencida, cancelada
  descricao text default '',
  evidencia_necessaria boolean default false,
  anexos text default '',
  comentarios text default '',
  data_conclusao text default '',
  resultado text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ATENDIMENTOS ────────────────────────────────────────────────────
create table if not exists public.gp_atendimentos (
  id text primary key,
  funcionario_id text not null,
  categoria text not null,
  descricao text default '',
  setor text default '',
  grau_urgencia text default 'normal',
  sigiloso boolean default false,
  responsavel text default '',
  status text default 'aberto',
  prazo_resposta text default '',
  providencias text default '',
  conclusao text default '',
  anexos text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── CHECKLISTS ──────────────────────────────────────────────────────
create table if not exists public.gp_checklists (
  id text primary key,
  tipo text not null,
  local text default '',
  responsavel text default '',
  data text default '',
  status text default 'aberto',
  observacoes text default '',
  assinatura_url text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.gp_checklists_itens (
  id text primary key,
  checklist_id text not null,
  item text not null,
  status text default 'conforme', -- conforme, nao conforme, nao se aplica
  observacao text default '',
  foto_url text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Disable RLS for all to match the project's logic where Auth is handled in API route layer
alter table public.gp_cargos_funcoes disable row level security;
alter table public.gp_documentos disable row level security;
alter table public.gp_treinamentos disable row level security;
alter table public.gp_funcionario_treinamento disable row level security;
alter table public.gp_inventario_riscos disable row level security;
alter table public.gp_plano_acao disable row level security;
alter table public.gp_atendimentos disable row level security;
alter table public.gp_checklists disable row level security;
alter table public.gp_checklists_itens disable row level security;
