ALTER TABLE academico_notas_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE academico_notas_aluno ENABLE ROW LEVEL SECURITY;
ALTER TABLE academico_notas_valor ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores caso existam para evitar duplicação
DROP POLICY IF EXISTS "Allow authenticated full access on academico_notas_lancamento" ON academico_notas_lancamento;
DROP POLICY IF EXISTS "Allow authenticated full access on academico_notas_aluno" ON academico_notas_aluno;
DROP POLICY IF EXISTS "Allow authenticated full access on academico_notas_valor" ON academico_notas_valor;

-- Cria as novas políticas permitindo leitura, inserção, atualização e deleção para usuários logados
CREATE POLICY "Allow authenticated full access on academico_notas_lancamento" ON academico_notas_lancamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on academico_notas_aluno" ON academico_notas_aluno FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on academico_notas_valor" ON academico_notas_valor FOR ALL TO authenticated USING (true) WITH CHECK (true);
