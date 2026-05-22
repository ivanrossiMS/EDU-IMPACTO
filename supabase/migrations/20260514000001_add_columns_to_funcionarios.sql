-- Add columns to funcionarios
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS celular TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS tipo_contrato TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS escolaridade TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS carga_horaria INTEGER;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS bonus NUMERIC DEFAULT 0;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS pis TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS agencia TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS conta TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS perfil_sistema TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS horario JSONB;

-- Migrate existing data from dados
UPDATE funcionarios SET
  codigo = COALESCE(codigo, dados->>'codigo'),
  cpf = COALESCE(cpf, dados->>'cpf'),
  rg = COALESCE(rg, dados->>'rg'),
  data_nascimento = COALESCE(data_nascimento, CASE WHEN dados->>'dataNascimento' = '' THEN NULL ELSE (dados->>'dataNascimento')::DATE END),
  telefone = COALESCE(telefone, dados->>'telefone'),
  celular = COALESCE(celular, dados->>'celular'),
  tipo_contrato = COALESCE(tipo_contrato, dados->>'tipoContrato'),
  escolaridade = COALESCE(escolaridade, dados->>'escolaridade'),
  carga_horaria = COALESCE(carga_horaria, CASE WHEN dados->>'cargaHoraria' = '' THEN NULL ELSE (dados->>'cargaHoraria')::INTEGER END),
  bonus = COALESCE(bonus, CASE WHEN dados->>'bonus' = '' THEN NULL ELSE (dados->>'bonus')::NUMERIC END),
  pis = COALESCE(pis, dados->>'pis'),
  banco = COALESCE(banco, dados->>'banco'),
  agencia = COALESCE(agencia, dados->>'agencia'),
  conta = COALESCE(conta, dados->>'conta'),
  observacoes = COALESCE(observacoes, dados->>'observacoes'),
  perfil_sistema = COALESCE(perfil_sistema, dados->>'perfilSistema'),
  horario = COALESCE(horario, dados->'horario');
