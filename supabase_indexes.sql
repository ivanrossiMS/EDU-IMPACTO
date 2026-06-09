-- ==============================================================================
-- Otimização de Performance: Criação de Índices GIN para Consultas JSONB
-- ==============================================================================
-- Execute este script no SQL Editor do seu painel do Supabase.
-- Ele criará índices GIN otimizados para buscas rápidas em colunas JSONB,
-- essenciais para a Agenda Digital que filtra por turmas e alunos dentro do JSON.

-- 1. Tabela 'comunicados'
-- Otimiza: dados->turmas.cs.["turma"] e dados->alunosIds.cs.["id"]
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_turmas ON comunicados USING GIN ((dados->'turmas') jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_alunosIds ON comunicados USING GIN ((dados->'alunosIds') jsonb_path_ops);

-- 2. Tabela 'momentos'
-- Otimiza buscas pelos arrays alvo de alunos e turmas (armazenados dentro da coluna JSONB "dados")
CREATE INDEX IF NOT EXISTS idx_momentos_targetClasses ON momentos USING GIN ((dados->'targetClasses') jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_momentos_alunosIds ON momentos USING GIN ((dados->'alunosIds') jsonb_path_ops);

-- 3. Tabela 'ocorrencias'
-- Indexação da data e aluno_id para timeline rápida
CREATE INDEX IF NOT EXISTS idx_ocorrencias_aluno_id ON ocorrencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_data ON ocorrencias(data DESC);

-- 4. Tabela 'system_users' (se buscar por perfil/cargo na auth)
CREATE INDEX IF NOT EXISTS idx_system_users_perfil ON system_users(perfil);

-- Nota: Estes índices garantem que consultas como .contains('dados->turmas', '["Turma A"]') 
-- utilizem buscas indexadas em log(N) ao invés de varreduras sequenciais (Full Table Scan).
