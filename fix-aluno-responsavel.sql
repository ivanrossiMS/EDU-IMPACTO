-- 1. Garante que TODAS as colunas necessárias existam na tabela aluno_responsavel
ALTER TABLE public.aluno_responsavel ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.aluno_responsavel ADD COLUMN IF NOT EXISTS parentesco text;
ALTER TABLE public.aluno_responsavel ADD COLUMN IF NOT EXISTS resp_pedagogico boolean NOT NULL DEFAULT false;
ALTER TABLE public.aluno_responsavel ADD COLUMN IF NOT EXISTS resp_financeiro boolean NOT NULL DEFAULT false;
ALTER TABLE public.aluno_responsavel ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. Migrar relacionamentos de vinculos
INSERT INTO public.aluno_responsavel (
  aluno_id, responsavel_id, tipo, parentesco, resp_pedagogico, resp_financeiro
)
SELECT
  a.id,
  r.id,
  NULLIF(trim(resp->>'tipo'),''),
  COALESCE(NULLIF(trim(resp->>'parentesco'),''),
    CASE resp->>'tipo' WHEN 'mae' THEN 'Mãe' WHEN 'pai' THEN 'Pai' ELSE 'Outro' END),
  COALESCE((resp->>'respPedagogico')::boolean, false),
  COALESCE((resp->>'respFinanceiro')::boolean, false)
FROM public.alunos a,
  jsonb_array_elements(COALESCE(a.dados->'responsaveis', '[]'::jsonb)) AS resp
JOIN public.responsaveis r
  ON r.nome = trim(resp->>'nome')
  AND (
    r.cpf = NULLIF(regexp_replace(COALESCE(resp->>'cpf',''),'\D','','g'),'')
    OR r.cpf IS NULL
  )
WHERE resp->>'nome' IS NOT NULL AND trim(resp->>'nome') != ''
ON CONFLICT (aluno_id, responsavel_id) DO UPDATE
  SET resp_pedagogico = EXCLUDED.resp_pedagogico,
      resp_financeiro = EXCLUDED.resp_financeiro;
