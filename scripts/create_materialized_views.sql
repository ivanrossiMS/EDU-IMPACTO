-- 📊 CRIAÇÃO DE MATERIALIZED VIEWS E FUNÇÕES DE AGREGAÇÃO PARA DASHBOARDS
-- Este script define estruturas agregadas de alta performance no PostgreSQL para
-- eliminar o delay de processamento de CPU no servidor do Next.js.

-- 1. Materialized View de Receitas Mensais Consolidadas (Titulos + JSONB de Parcelas)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_receitas_mensais AS
WITH parcelas_jsonb AS (
  SELECT 
    CASE 
      WHEN p."dtPagto" LIKE '%/%' THEN 
        split_part(p."dtPagto", '/', 3) || '-' || split_part(p."dtPagto", '/', 2)
      ELSE 
        substring(p."dtPagto" from 1 for 7)
    END as mes_referencia,
    coalesce(nullif(p."valorFinal", '')::numeric, nullif(p.valor, '')::numeric, 0) as valor
  FROM public.alunos a,
  LATERAL jsonb_to_recordset(
    CASE 
      WHEN jsonb_typeof(a.dados->'parcelas') = 'array' THEN a.dados->'parcelas' 
      ELSE '[]'::jsonb 
    END
  ) as p(status text, "dtPagto" text, valor text, "valorFinal" text)
  WHERE p.status = 'pago' AND p."dtPagto" IS NOT NULL AND p."dtPagto" != ''
),
titulos_pagos AS (
  SELECT 
    substring(pagamento::text from 1 for 7) as mes_referencia,
    coalesce(valor::numeric, 0) as valor
  FROM public.titulos
  WHERE status = 'pago' AND pagamento IS NOT NULL
)
SELECT 
  mes_referencia,
  sum(valor) as receita_total
FROM (
  SELECT mes_referencia, valor FROM parcelas_jsonb
  UNION ALL
  SELECT mes_referencia, valor FROM titulos_pagos
) as todas_receitas
WHERE mes_referencia ~ '^\d{4}-\d{2}$'
GROUP BY mes_referencia
ORDER BY mes_referencia DESC;

-- Criar índice exclusivo para permitir REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_receitas_mensais_mes ON public.mv_receitas_mensais(mes_referencia);

-- 2. Função RPC para atualizar de forma rápida as views no banco
CREATE OR REPLACE FUNCTION public.refresh_mv_receitas_mensais()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_receitas_mensais;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função RPC para obter estatísticas agregadas do Dashboard de forma instantânea
CREATE OR REPLACE FUNCTION public.get_dashboard_aggregates(mes_alvo text, mes_prev text)
RETURNS json AS $$
DECLARE
  total_alunos bigint;
  risco_alto bigint;
  risco_medio bigint;
  risco_baixo bigint;
  inadimplentes bigint := 0;
  receita_mes numeric := 0;
  receita_prev numeric := 0;
  funcionarios_ativos bigint;
  turmas_capacidade bigint;
  ret_json json;
BEGIN
  -- Alunos
  SELECT count(*),
         count(*) FILTER (WHERE risco_evasao = 'alto'),
         count(*) FILTER (WHERE risco_evasao = 'medio'),
         count(*) FILTER (WHERE risco_evasao = 'baixo')
  INTO total_alunos, risco_alto, risco_medio, risco_baixo
  FROM public.alunos
  WHERE status = 'matriculado';

  -- Funcionários ativos
  SELECT count(*) INTO funcionarios_ativos 
  FROM public.funcionarios 
  WHERE status = 'ativo';

  -- Capacidade de turmas
  SELECT coalesce(sum(capacidade::bigint), 0) INTO turmas_capacidade 
  FROM public.turmas;

  -- Receita do mês alvo
  SELECT coalesce(receita_total, 0) INTO receita_mes 
  FROM public.mv_receitas_mensais 
  WHERE mes_referencia = mes_alvo;

  -- Receita do mês anterior
  SELECT coalesce(receita_total, 0) INTO receita_prev 
  FROM public.mv_receitas_mensais 
  WHERE mes_referencia = mes_prev;

  -- Calcular inadimplência a partir do JSONB de parcelas de alunos ativos
  SELECT count(*) INTO inadimplentes
  FROM (
    SELECT DISTINCT a.id
    FROM public.alunos a,
    LATERAL jsonb_to_recordset(
      CASE 
        WHEN jsonb_typeof(a.dados->'parcelas') = 'array' THEN a.dados->'parcelas' 
        ELSE '[]'::jsonb 
      END
    ) as p(status text, vencimento text)
    WHERE a.status = 'matriculado' 
      AND p.status = 'pendente' 
      AND p.vencimento IS NOT NULL
      AND (
        CASE 
          WHEN p.vencimento LIKE '%/%' THEN 
            to_date(p.vencimento, 'DD/MM/YYYY')
          ELSE 
            to_date(p.vencimento, 'YYYY-MM-DD')
        END
      ) < CURRENT_DATE
  ) AS inadimplentes_query;

  -- Montar resultado consolidado
  ret_json := json_build_object(
    'totalAlunos', total_alunos,
    'riscoAlto', risco_alto,
    'riscoMedio', risco_medio,
    'riscoBaixo', risco_baixo,
    'receitaMes', receita_mes,
    'receitaPrev', receita_prev,
    'funcionariosAtivos', funcionarios_ativos,
    'turmasCapacidade', turmas_capacidade,
    'inadimplentes', inadimplentes
  );

  RETURN ret_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
