-- =========================================================================================
-- FASE A: REESTRUTURAÇÃO DO BANCO DE DADOS FINANCEIRO (PADRÃO FAANG)
-- Execute este script no SQL Editor do Supabase (Aba SQL)
-- =========================================================================================

-- 1. EXTENSÃO UUID SE NECESSÁRIA (Costuma vir padrão)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE EVENTOS (Contratos, Macro-Cobranças, Matrículas)
CREATE TABLE IF NOT EXISTS public.fin_eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aluno_id TEXT NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL DEFAULT 'mensalidade', -- 'matricula', 'mensalidade', 'extra'
    descricao TEXT NOT NULL,
    plano_contas_id VARCHAR(100),
    valor_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    qtde_parcelas INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'ativo', -- 'ativo', 'cancelado', 'concluido'
    dados_legados JSONB, -- Para resguardo histórico do JSON da migração
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE PARCELAS (Dívida Granular)
CREATE TABLE IF NOT EXISTS public.fin_parcelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id UUID NOT NULL REFERENCES public.fin_eventos(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL DEFAULT 1,
    descricao TEXT NOT NULL,
    vencimento DATE NOT NULL,
    valor_original DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    desconto DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    juros DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    multa DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    valor_pago DECIMAL(12, 2),
    data_pagamento DATE,
    caixa_id VARCHAR(50), -- Onde entrou o dinheiro (PDV)
    status VARCHAR(30) NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'cancelado', 'isento'
    responsavel_pagamento VARCHAR(150), -- Quem pagou (se diferente do default)
    dados_legados JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ÍNDICES B-TREE (Performance O(1))
CREATE INDEX IF NOT EXISTS idx_fin_eventos_aluno ON public.fin_eventos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_fin_parcelas_evento ON public.fin_parcelas(evento_id);
CREATE INDEX IF NOT EXISTS idx_fin_parcelas_vcto ON public.fin_parcelas(vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_parcelas_status ON public.fin_parcelas(status);

-- 5. Função de Auto-Updated_At (Evita desync temporal)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.atualizado_em = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Gatilhos Temporal
DROP TRIGGER IF EXISTS trg_fin_eventos_updated_at ON public.fin_eventos;
CREATE TRIGGER trg_fin_eventos_updated_at BEFORE UPDATE ON public.fin_eventos FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS trg_fin_parcelas_updated_at ON public.fin_parcelas;
CREATE TRIGGER trg_fin_parcelas_updated_at BEFORE UPDATE ON public.fin_parcelas FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- =========================================================================================
-- IMPORTANTE:
-- As tabelas estão criadas, mas inicialmente sem Políticas de RLS duras (apenas ativadas 
-- no próximo ciclo após migração), para permitirmos que o Script Node.JS da Fase B faça
-- o Bulk Insert pesado.
-- =========================================================================================
