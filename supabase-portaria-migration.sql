-- ================================================================
-- PORTARIA iDFACE — Migration SQL
-- Módulo de Controle de Entrada de Alunos via Reconhecimento Facial
-- ================================================================

-- ─── DISPOSITIVOS iDFACE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portaria_dispositivos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  ip text NOT NULL DEFAULT '',
  porta integer DEFAULT 443,
  unidade text DEFAULT '',
  modelo text DEFAULT 'iDFace',
  status text DEFAULT 'offline',
  ultima_comunicacao timestamptz,
  configuracao jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portaria_disp_unidade ON public.portaria_dispositivos(unidade);
ALTER TABLE public.portaria_dispositivos DISABLE ROW LEVEL SECURITY;

-- ─── EVENTOS DE ACESSO (ENTRADAS) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portaria_eventos (
  id text PRIMARY KEY,
  aluno_id text,
  aluno_nome text DEFAULT '',
  dispositivo_id text NOT NULL,
  dispositivo_nome text DEFAULT '',
  tipo text DEFAULT 'entrada',
  status text DEFAULT 'sucesso',
  data_hora timestamptz NOT NULL DEFAULT now(),
  user_id_equipamento text DEFAULT '',
  confianca numeric DEFAULT 0,
  foto_captura text,
  payload_raw jsonb DEFAULT '{}',
  unidade text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portaria_ev_aluno ON public.portaria_eventos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_portaria_ev_data ON public.portaria_eventos(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_portaria_ev_disp ON public.portaria_eventos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_portaria_ev_status ON public.portaria_eventos(status);
ALTER TABLE public.portaria_eventos DISABLE ROW LEVEL SECURITY;

-- ─── SINCRONIZAÇÃO ALUNO ↔ DISPOSITIVO ──────────────────────────
CREATE TABLE IF NOT EXISTS public.portaria_sync (
  aluno_id text NOT NULL,
  dispositivo_id text NOT NULL,
  status text DEFAULT 'pendente',
  ultima_sync timestamptz,
  foto_enviada boolean DEFAULT false,
  erro_detalhe text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (aluno_id, dispositivo_id)
);

CREATE INDEX IF NOT EXISTS idx_portaria_sync_status ON public.portaria_sync(status);
ALTER TABLE public.portaria_sync DISABLE ROW LEVEL SECURITY;

-- ─── CONFIGURAÇÃO (reutiliza tabela existente) ───────────────────
INSERT INTO public.configuracoes (chave, valor) VALUES ('portaria_config', '{
  "sync_automatica_novos_alunos": true,
  "remover_inativos_automaticamente": true,
  "reenviar_foto_ao_atualizar": true,
  "modo_somente_entrada": true,
  "intervalo_sync_minutos": 30,
  "fallback_matricula_como_codigo": true
}') ON CONFLICT (chave) DO NOTHING;
