-- 1. Garante que TODAS as colunas necessárias existam na tabela responsaveis
-- (Isso previne erros caso a tabela tenha sido criada em alguma etapa anterior com colunas a menos)
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS org_emissor text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS data_nasc text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS celular text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS profissao text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS parentesco text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS naturalidade text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS nacionalidade text DEFAULT 'Brasileira';
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS estado_civil text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS rfid text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS codigo text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS obs text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS endereco jsonb DEFAULT '{}';
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS dados jsonb DEFAULT '{}';
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Recriar/Garantir constraints apenas para seguranca
CREATE UNIQUE INDEX IF NOT EXISTS responsaveis_cpf_uq ON public.responsaveis (cpf) WHERE cpf IS NOT NULL AND trim(cpf) != '';

-- 3. Rodar a migração
INSERT INTO public.responsaveis (
  id, nome, cpf, celular, telefone, email,
  parentesco, tipo, rfid, codigo, dados
)
SELECT
  CASE
    WHEN (resp->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (resp->>'id')::uuid
    ELSE gen_random_uuid()
  END,
  trim(resp->>'nome'),
  NULLIF(trim(regexp_replace(COALESCE(resp->>'cpf',''), '\D', '', 'g')), ''),
  NULLIF(trim(COALESCE(resp->>'celular','')), ''),
  NULLIF(trim(COALESCE(resp->>'telefone','')), ''),
  NULLIF(trim(COALESCE(resp->>'email','')), ''),
  COALESCE(NULLIF(trim(resp->>'parentesco'),''), 
    CASE resp->>'tipo' WHEN 'mae' THEN 'Mãe' WHEN 'pai' THEN 'Pai' ELSE 'Outro' END),
  NULLIF(trim(resp->>'tipo'),''),
  NULLIF(trim(COALESCE(resp->>'rfid','')), ''),
  NULLIF(trim(COALESCE(resp->>'codigo','')), ''),
  resp
FROM public.alunos,
  jsonb_array_elements(COALESCE(dados->'responsaveis', '[]'::jsonb)) AS resp
WHERE
  resp->>'nome' IS NOT NULL AND trim(resp->>'nome') != ''
ON CONFLICT DO NOTHING;

-- 4. Criar a estrutura para vínculos (caso ainda falhe no final)
CREATE TABLE IF NOT EXISTS public.aluno_responsavel (
  aluno_id         uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  responsavel_id   uuid NOT NULL REFERENCES public.responsaveis(id) ON DELETE RESTRICT,
  tipo             text,
  parentesco       text,
  resp_pedagogico  boolean NOT NULL DEFAULT false,
  resp_financeiro  boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(aluno_id, responsavel_id)
);

-- 5. Migrar relacionamentos de vinculos
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
