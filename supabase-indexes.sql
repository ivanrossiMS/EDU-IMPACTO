-- ============================================================
-- ERP IMPACTO EDU — PERFORMANCE INDEXES
-- Execute este script no Supabase SQL Editor para adicionar
-- índices críticos que eliminam full-table-scans nas queries
-- mais frequentes do sistema.
-- ============================================================

-- ── TITULOS ──────────────────────────────────────────────────
-- Queries mais comuns: filtro por status, aluno, vencimento
CREATE INDEX IF NOT EXISTS idx_titulos_status ON titulos(status);
CREATE INDEX IF NOT EXISTS idx_titulos_aluno ON titulos(aluno);
CREATE INDEX IF NOT EXISTS idx_titulos_vencimento ON titulos(vencimento);
CREATE INDEX IF NOT EXISTS idx_titulos_aluno_status ON titulos(aluno, status);
CREATE INDEX IF NOT EXISTS idx_titulos_status_vencimento ON titulos(status, vencimento);

-- ── CONTAS_PAGAR ─────────────────────────────────────────────
-- Filtros comuns: status, fornecedor, vencimento
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor ON contas_pagar(fornecedor);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON contas_pagar(vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status_vencimento ON contas_pagar(status, vencimento);

-- ── ALUNOS ────────────────────────────────────────────────────
-- Filtros comuns: status, turma, serie, busca por nome/matricula
CREATE INDEX IF NOT EXISTS idx_alunos_status ON alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_turma ON alunos(turma);
CREATE INDEX IF NOT EXISTS idx_alunos_serie ON alunos(serie);
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome);
CREATE INDEX IF NOT EXISTS idx_alunos_inadimplente ON alunos(inadimplente) WHERE inadimplente = true;
CREATE INDEX IF NOT EXISTS idx_alunos_turma_status ON alunos(turma, status);

-- ── TURMAS ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_turmas_serie ON turmas(serie);
CREATE INDEX IF NOT EXISTS idx_turmas_turno ON turmas(turno);
CREATE INDEX IF NOT EXISTS idx_turmas_unidade ON turmas(unidade);

-- ── LEADS ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_responsavel ON leads(responsavel);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- ── MOVIMENTACOES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_status ON movimentacoes(status);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_plano_contas ON movimentacoes(plano_contas_id);

-- ── FORNECEDORES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fornecedores_status ON fornecedores(status);
CREATE INDEX IF NOT EXISTS idx_fornecedores_categoria ON fornecedores(categoria);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(nome);

-- ── OCORRENCIAS ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ocorrencias_aluno_id ON ocorrencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_data ON ocorrencias(data);

-- ── FREQUENCIAS ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_frequencias_aluno_id ON frequencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_turma_id ON frequencias(turma_id);
CREATE INDEX IF NOT EXISTS idx_frequencias_data ON frequencias(data);
CREATE INDEX IF NOT EXISTS idx_frequencias_aluno_data ON frequencias(aluno_id, data);

-- ── LANCAMENTOS_NOTA ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lancamentos_nota_aluno ON lancamentos_nota(aluno_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_nota_turma ON lancamentos_nota(turma_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_nota_aluno_periodo ON lancamentos_nota(aluno_id, periodo);

-- ── AGENDAMENTOS ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_responsavel ON agendamentos(responsavel);

-- ── COMUNICADOS ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comunicados_fixado ON comunicados(fixado) WHERE fixado = true;
CREATE INDEX IF NOT EXISTS idx_comunicados_destino ON comunicados(destino);
CREATE INDEX IF NOT EXISTS idx_comunicados_data ON comunicados(data DESC);

-- ── CONFIGURACOES ─────────────────────────────────────────────
-- Já tem PK em chave, mas garantir índice explícito
CREATE INDEX IF NOT EXISTS idx_configuracoes_chave ON configuracoes(chave);

-- ── SYSTEM_LOGS ───────────────────────────────────────────────
-- Logs são consultados com ORDER BY data_hora DESC e filtros de módulo
CREATE INDEX IF NOT EXISTS idx_system_logs_data_hora ON system_logs(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_modulo ON system_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_system_logs_usuario ON system_logs(usuario_nome);

-- ── MANTENEDORES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mantenedores_cnpj ON mantenedores(cnpj);

-- ============================================================
-- VACUUM ANALYZE após criar índices (otimiza o planner)
-- Execute separadamente se necessário:
-- VACUUM ANALYZE titulos;
-- VACUUM ANALYZE alunos;
-- VACUUM ANALYZE contas_pagar;
-- VACUUM ANALYZE frequencias;
-- VACUUM ANALYZE lancamentos_nota;
-- ============================================================
