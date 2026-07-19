-- ================================================================
-- IMPACTO EDU — Schema para Novas Funcionalidades (Gestão de Pessoas)
-- Saúde Mental, Canal de Denúncias, Pesquisa de Clima, Assinatura Eletrônica
-- Execute este SQL no Supabase → SQL Editor → New Query → Run
-- ================================================================

-- ─── CANAL DE DENÚNCIAS ──────────────────────────────────────────────
create table if not exists public.gp_denuncias (
  id text primary key,
  protocolo text not null,
  tipo text default '', -- assedio, fraude, conduta, etc
  descricao text not null,
  data_ocorrencia text default '',
  setor text default '',
  envolvidos text default '',
  anonimo boolean default true,
  relator_id text, -- nulo se anonimo, senao id do usuario logado
  status text default 'nova', -- nova, em_analise, concluida
  providencias text default '',
  anexos text default '',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── PESQUISA DE CLIMA ───────────────────────────────────────────────
create table if not exists public.gp_pesquisas_clima (
  id text primary key,
  titulo text not null,
  semestre text default '',
  ano text default '',
  status text default 'rascunho', -- rascunho, ativa, encerrada
  data_inicio text default '',
  data_fim text default '',
  perguntas jsonb default '[]',
  dados jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Respostas das Pesquisas
create table if not exists public.gp_pesquisas_respostas (
  id text primary key,
  pesquisa_id text not null,
  funcionario_id text, -- opcional, null se a pesquisa for anonima
  respostas jsonb default '{}',
  dados jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── ASSINATURA ELETRÔNICA ───────────────────────────────────────────
-- Registro imutável de quem assinou o que (treinamentos, politicas, etc)
create table if not exists public.gp_assinaturas (
  id text primary key,
  user_id text not null,
  entidade_tipo text not null, -- 'treinamento', 'documento', 'plano_acao'
  entidade_id text not null,
  hash_assinatura text not null,
  ip_address text default '',
  user_agent text default '',
  dados jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── RLS (Row Level Security) ────────────────────────────────────────
-- Desativando RLS por padrão para seguir a lógica do app via rotas de API
alter table public.gp_denuncias disable row level security;
alter table public.gp_pesquisas_clima disable row level security;
alter table public.gp_pesquisas_respostas disable row level security;
alter table public.gp_assinaturas disable row level security;
