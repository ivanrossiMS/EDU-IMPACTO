-- 🚀 SCRIPTS DE ÍNDICES DE ALTA PERFORMANCE PARA O BANCO DE DADOS EDU-IMPACTO
-- Este arquivo contém a definição de índices para otimização de consultas relacionais,
-- filtros de listagem e buscas de portaria. Execute no console SQL do Supabase.

-- 1. Índices da Tabela de Alunos (Filtros de Listagem e Portaria)
CREATE INDEX IF NOT EXISTS idx_alunos_matricula ON public.alunos(matricula);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_unidade ON public.alunos(unidade);
CREATE INDEX IF NOT EXISTS idx_alunos_risco_evasao ON public.alunos(risco_evasao);

-- 2. Índices da Tabela de Matrículas (Consultas Relacionais e Históricos)
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno_id ON public.matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma_id ON public.matriculas(turma_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_ano_letivo ON public.matriculas(ano_letivo);
CREATE INDEX IF NOT EXISTS idx_matriculas_status ON public.matriculas(status);
CREATE INDEX IF NOT EXISTS idx_matriculas_situacao ON public.matriculas(situacao);

-- 3. Índices da Tabela de Vínculos Aluno-Responsável (N:M)
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_aluno_id ON public.aluno_responsavel(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_responsavel_id ON public.aluno_responsavel(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_resp_financeiro ON public.aluno_responsavel(resp_financeiro);

-- 4. Índices da Tabela de Títulos Financeiros (Gargalo de DRE e Dashboard)
CREATE INDEX IF NOT EXISTS idx_titulos_aluno ON public.titulos(aluno);
CREATE INDEX IF NOT EXISTS idx_titulos_status ON public.titulos(status);
CREATE INDEX IF NOT EXISTS idx_titulos_vencimento ON public.titulos(vencimento);
CREATE INDEX IF NOT EXISTS idx_titulos_pagamento ON public.titulos(pagamento);

-- 5. Índices de Ocorrências e Frequência Escolar
CREATE INDEX IF NOT EXISTS idx_ocorrencias_aluno_id ON public.ocorrencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_aluno_id ON public.frequencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_data ON public.frequencias(data);

-- 6. Índices da Tabela de Turmas
CREATE INDEX IF NOT EXISTS idx_turmas_unidade ON public.turmas(unidade);

-- 7. Índices da Tabela de Logs de Sistema (Auditoria e Realtime)
CREATE INDEX IF NOT EXISTS idx_system_logs_data_hora ON public.system_logs(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_acao ON public.system_logs(acao);
