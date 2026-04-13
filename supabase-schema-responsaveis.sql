-- ================================================================
-- IMPACTO EDU — Schema: Responsáveis Independentes
-- Execute no painel SQL do Supabase
-- ================================================================

-- ─── TABELA: responsaveis (entidade independente) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.responsaveis (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL CHECK (char_length(trim(nome)) >= 2),
  cpf           text,
  rg            text,
  org_emissor   text,
  sexo          text,
  data_nasc     text,
  email         text,
  telefone      text,
  celular       text,
  profissao     text,
  parentesco    text,       -- 'Mãe', 'Pai', 'Avó', etc. (label display)
  tipo          text,       -- 'mae', 'pai', 'outro' (key interno)
  naturalidade  text,
  uf            text,
  nacionalidade text DEFAULT 'Brasileira',
  estado_civil  text,
  rfid          text,
  codigo        text,
  obs           text,
  endereco      jsonb DEFAULT '{}',
  dados         jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- CPF único: só aplica quando o CPF não é nulo/vazio
CREATE UNIQUE INDEX IF NOT EXISTS responsaveis_cpf_uq
  ON public.responsaveis (cpf)
  WHERE cpf IS NOT NULL AND trim(cpf) != '';

-- Índice busca por nome (autocomplete)
CREATE INDEX IF NOT EXISTS responsaveis_nome_idx
  ON public.responsaveis (nome text_pattern_ops);

-- Índice busca por email
CREATE INDEX IF NOT EXISTS responsaveis_email_idx
  ON public.responsaveis (email);

-- Índice busca por celular
CREATE INDEX IF NOT EXISTS responsaveis_celular_idx
  ON public.responsaveis (celular);

-- RLS
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "responsaveis_auth" ON public.responsaveis;
CREATE POLICY "responsaveis_auth" ON public.responsaveis
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── TABELA: aluno_responsavel (vínculo N:M com papéis) ─────────────────────
CREATE TABLE IF NOT EXISTS public.aluno_responsavel (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id         uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  responsavel_id   uuid NOT NULL REFERENCES public.responsaveis(id) ON DELETE RESTRICT,
  tipo             text,       -- 'mae', 'pai', 'outro'
  parentesco       text,       -- label display
  resp_pedagogico  boolean NOT NULL DEFAULT false,
  resp_financeiro  boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(aluno_id, responsavel_id)
);

CREATE INDEX IF NOT EXISTS aluno_resp_aluno_idx  ON public.aluno_responsavel (aluno_id);
CREATE INDEX IF NOT EXISTS aluno_resp_resp_idx   ON public.aluno_responsavel (responsavel_id);

ALTER TABLE public.aluno_responsavel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aluno_responsavel_auth" ON public.aluno_responsavel;
CREATE POLICY "aluno_responsavel_auth" ON public.aluno_responsavel
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── TRIGGER: updated_at automático ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS responsaveis_updated_at ON public.responsaveis;
CREATE TRIGGER responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── MIGRAÇÃO: responsáveis existentes do JSONB → tabela própria ─────────────
-- Executa somente se ainda não migrou (idempotente)
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

-- ─── MIGRAÇÃO: criar vínculos aluno_responsavel ──────────────────────────────
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

-- ─── VIEW AUXILIAR: responsáveis com alunos vinculados ───────────────────────
CREATE OR REPLACE VIEW public.v_responsaveis_com_filhos AS
SELECT
  r.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', a.id,
        'nome', a.nome,
        'turma', a.turma,
        'serie', a.serie,
        'status', a.status,
        'frequencia', a.frequencia,
        'inadimplente', a.inadimplente,
        'risco_evasao', a.risco_evasao,
        'parentesco', ar.parentesco,
        'resp_pedagogico', ar.resp_pedagogico,
        'resp_financeiro', ar.resp_financeiro
      )
    ) FILTER (WHERE a.id IS NOT NULL),
    '[]'::json
  ) AS filhos
FROM public.responsaveis r
LEFT JOIN public.aluno_responsavel ar ON ar.responsavel_id = r.id
LEFT JOIN public.alunos a ON a.id = ar.aluno_id AND a.status != 'excluido'
GROUP BY r.id;
