-- Remove a tabela antiga se existir para recriar com o tipo correto
DROP TABLE IF EXISTS logs_auditoria CASCADE;

-- Cria a tabela de logs de auditoria
CREATE TABLE logs_auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_nome TEXT NOT NULL,
  registro_id TEXT NOT NULL, -- Alterado para TEXT para suportar qualquer tipo de ID
  acao TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  dados_antigos JSONB,
  dados_novos JSONB,
  usuario_id UUID, -- ID do usuário que fez a alteração (se disponível)
  data_hora TIMESTAMPTZ DEFAULT now()
);

-- Habilita RLS na tabela de auditoria (Apenas leitura para autenticados)
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura de logs para usuários autenticados" ON logs_auditoria
  FOR SELECT TO authenticated USING (true);

-- Função trigger para registrar auditoria
CREATE OR REPLACE FUNCTION processa_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO logs_auditoria (tabela_nome, registro_id, acao, dados_antigos, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO logs_auditoria (tabela_nome, registro_id, acao, dados_antigos, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO logs_auditoria (tabela_nome, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincula a trigger às tabelas
-- Alunos
DROP TRIGGER IF EXISTS trigger_auditoria_alunos ON alunos;
CREATE TRIGGER trigger_auditoria_alunos
AFTER INSERT OR UPDATE OR DELETE ON alunos
FOR EACH ROW EXECUTE FUNCTION processa_auditoria();

-- Responsáveis
DROP TRIGGER IF EXISTS trigger_auditoria_responsaveis ON responsaveis;
CREATE TRIGGER trigger_auditoria_responsaveis
AFTER INSERT OR UPDATE OR DELETE ON responsaveis
FOR EACH ROW EXECUTE FUNCTION processa_auditoria();

-- Aluno_Responsavel
DROP TRIGGER IF EXISTS trigger_auditoria_aluno_responsavel ON aluno_responsavel;
CREATE TRIGGER trigger_auditoria_aluno_responsavel
AFTER INSERT OR UPDATE OR DELETE ON aluno_responsavel
FOR EACH ROW EXECUTE FUNCTION processa_auditoria();
