-- Habilita RLS nas tabelas
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno_responsavel ENABLE ROW LEVEL SECURITY;

-- Cria políticas de acesso (Usuários autenticados podem fazer tudo por padrão)
-- Nota: Isso garante que o sistema continue funcionando enquanto você refina as permissões por role.

-- Alunos
CREATE POLICY "Permitir leitura para usuários autenticados" ON alunos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" ON alunos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização para usuários autenticados" ON alunos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão para usuários autenticados" ON alunos
  FOR DELETE TO authenticated USING (true);

-- Responsáveis
CREATE POLICY "Permitir leitura para usuários autenticados" ON responsaveis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" ON responsaveis
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização para usuários autenticados" ON responsaveis
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão para usuários autenticados" ON responsaveis
  FOR DELETE TO authenticated USING (true);

-- Aluno_Responsavel (Vínculos)
CREATE POLICY "Permitir leitura para usuários autenticados" ON aluno_responsavel
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" ON aluno_responsavel
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização para usuários autenticados" ON aluno_responsavel
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão para usuários autenticados" ON aluno_responsavel
  FOR DELETE TO authenticated USING (true);
