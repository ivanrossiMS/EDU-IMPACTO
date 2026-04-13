-- ================================================================
-- IMPACTO EDU — Migração: Validação de Recibo
-- Execute no Supabase → SQL Editor → New Query → Run
-- ================================================================

-- TABELA: financial_receipts
CREATE TABLE IF NOT EXISTS public.financial_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number        TEXT NOT NULL,
  receipt_version       INTEGER NOT NULL DEFAULT 1,
  receipt_status        TEXT NOT NULL DEFAULT 'valido',
  -- Status: 'valido' | 'cancelado' | 'estornado' | 'substituido' | 'invalido' | 'inconsistente'

  -- Tokens de validação
  validation_token      TEXT NOT NULL UNIQUE,
  validation_hash       TEXT NOT NULL,
  public_validation_url TEXT NOT NULL DEFAULT '',

  -- Vínculos com entidades do ERP
  baixa_id              TEXT NOT NULL,
  event_id              TEXT DEFAULT '',
  aluno_id              TEXT DEFAULT '',
  responsavel_id        TEXT DEFAULT '',
  unidade_id            TEXT DEFAULT '',
  caixa_id              TEXT DEFAULT '',

  -- Snapshot financeiro (imutável após emissão)
  payment_date          DATE,
  issue_date            TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_amount       NUMERIC(12,2) DEFAULT 0,
  discount_amount       NUMERIC(12,2) DEFAULT 0,
  interest_amount       NUMERIC(12,2) DEFAULT 0,
  penalty_amount        NUMERIC(12,2) DEFAULT 0,
  paid_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method        TEXT DEFAULT '',

  -- Snapshot do pagador (seguro, sem dados sensíveis completos)
  payer_name            TEXT DEFAULT '',
  payer_document        TEXT DEFAULT '',       -- CPF/CNPJ mascarado
  aluno_nome            TEXT DEFAULT '',
  aluno_turma           TEXT DEFAULT '',
  responsavel_nome      TEXT DEFAULT '',
  unidade_nome          TEXT DEFAULT '',

  -- Evento financeiro
  event_description     TEXT DEFAULT '',
  notes                 TEXT DEFAULT '',

  -- Controle de ciclo de vida
  is_active             BOOLEAN DEFAULT true,
  canceled_at           TIMESTAMPTZ,
  canceled_by           TEXT DEFAULT '',
  cancellation_reason   TEXT DEFAULT '',
  reversed_at           TIMESTAMPTZ,
  reversed_by           TEXT DEFAULT '',
  replaced_by_receipt_id UUID,
  replaces_receipt_id    UUID,

  -- Auditoria
  created_by            TEXT DEFAULT '',
  updated_by            TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_token ON public.financial_receipts(validation_token);
CREATE INDEX IF NOT EXISTS idx_receipts_baixa ON public.financial_receipts(baixa_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.financial_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_aluno ON public.financial_receipts(aluno_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.financial_receipts(receipt_status);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.financial_receipts(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON public.financial_receipts(created_at DESC);

ALTER TABLE public.financial_receipts DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------

-- TABELA: receipt_validation_logs
CREATE TABLE IF NOT EXISTS public.receipt_validation_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id            UUID,
  baixa_id              TEXT DEFAULT '',
  validation_token      TEXT DEFAULT '',
  validation_type       TEXT DEFAULT 'token',
  -- Tipos: 'token' | 'hash' | 'receipt_number' | 'baixa_id' | 'manual'
  validation_origin     TEXT DEFAULT 'publica',
  -- Origens: 'publica' | 'interna'
  result_status         TEXT DEFAULT 'valido',
  result_message        TEXT DEFAULT '',
  ip_address            TEXT DEFAULT '',
  user_agent            TEXT DEFAULT '',
  validated_by_user_id  TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_val_logs_receipt ON public.receipt_validation_logs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_val_logs_created ON public.receipt_validation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_val_logs_token ON public.receipt_validation_logs(validation_token);

ALTER TABLE public.receipt_validation_logs DISABLE ROW LEVEL SECURITY;
