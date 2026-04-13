-- 1. Garante que as colunas 'celular' e 'telefone' existam caso a tabela tenha sido criada em versão anterior
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS celular text;

-- 2. Rodar a migração sem erros agora:
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
