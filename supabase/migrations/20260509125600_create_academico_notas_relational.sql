CREATE TABLE IF NOT EXISTS academico_notas_lancamento (
  id TEXT PRIMARY KEY,
  turma_id TEXT NOT NULL,
  disciplina TEXT NOT NULL,
  bimestre INTEGER NOT NULL,
  esquema_id TEXT,
  criado_por TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academico_notas_aluno (
  id TEXT PRIMARY KEY,
  lancamento_id TEXT NOT NULL REFERENCES academico_notas_lancamento(id) ON DELETE CASCADE,
  aluno_id TEXT NOT NULL,
  media_parcial NUMERIC,
  faltas INTEGER DEFAULT 0,
  situacao TEXT
);

CREATE TABLE IF NOT EXISTS academico_notas_valor (
  id TEXT PRIMARY KEY,
  nota_aluno_id TEXT NOT NULL REFERENCES academico_notas_aluno(id) ON DELETE CASCADE,
  detalhe_id TEXT NOT NULL,
  valor TEXT
);

CREATE INDEX IF NOT EXISTS idx_academico_notas_lancamento_turma ON academico_notas_lancamento(turma_id);
CREATE INDEX IF NOT EXISTS idx_academico_notas_aluno_lancamento ON academico_notas_aluno(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_academico_notas_valor_nota_aluno ON academico_notas_valor(nota_aluno_id);
