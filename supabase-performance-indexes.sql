-- Performance indexes to speed up the heaviest queries in EDU-IMPACTO

-- 1. system_logs
-- Speed up the GET /api/system-logs which orders by data_hora and limits 200
CREATE INDEX IF NOT EXISTS idx_system_logs_data_hora 
ON system_logs(data_hora DESC);

-- Speed up the filtered query for specific modules
CREATE INDEX IF NOT EXISTS idx_system_logs_modulo_data 
ON system_logs(modulo, data_hora DESC);

-- 2. academico/notas
-- Speed up querying grades for a specific class and student
CREATE INDEX IF NOT EXISTS idx_notas_lancamento_turma 
ON academico_notas_lancamento(turma_id);

CREATE INDEX IF NOT EXISTS idx_notas_aluno 
ON academico_notas_aluno(aluno_id);

-- 3. academico/frequencias
-- Speed up listing frequencies grouped by date for a class
CREATE INDEX IF NOT EXISTS idx_frequencias_data_turma 
ON frequencias(data DESC, turma_id);
