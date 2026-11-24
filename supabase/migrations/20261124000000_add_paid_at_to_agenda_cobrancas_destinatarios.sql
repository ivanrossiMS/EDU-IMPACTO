-- Adiciona coluna dedicada de data de pagamento (paid_at) e updated_at em agenda_cobrancas_destinatarios.
-- Antes desta migração, não existia paid_at nem updated_at na tabela, fazendo o frontend exibir created_at (data de envio) como data de pagamento.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda_cobrancas_destinatarios'
  ) THEN
    ALTER TABLE public.agenda_cobrancas_destinatarios
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_agenda_cobrancas_dest_paid_at
      ON public.agenda_cobrancas_destinatarios (cobranca_id, paid_at)
      WHERE paid_at IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_agenda_cobrancas_destinatarios_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agenda_cobrancas_destinatarios'
  ) THEN
    DROP TRIGGER IF EXISTS trg_agenda_cobrancas_destinatarios_updated_at
      ON public.agenda_cobrancas_destinatarios;
    CREATE TRIGGER trg_agenda_cobrancas_destinatarios_updated_at
      BEFORE UPDATE ON public.agenda_cobrancas_destinatarios
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_agenda_cobrancas_destinatarios_updated_at();
  END IF;
END $$;
