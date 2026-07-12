-- 1. Criação de índices essenciais para listagem de alunos e comunicação
CREATE INDEX IF NOT EXISTS idx_alunos_turma ON public.alunos (turma);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos (status);
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_aluno ON public.aluno_responsavel (aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_responsavel ON public.aluno_responsavel (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_turmas_codigo ON public.turmas (codigo);
CREATE INDEX IF NOT EXISTS idx_turmas_nome ON public.turmas (nome);

-- 2. View Otimizada para Alunos com Vínculos (Substitui Join no JavaScript)
CREATE OR REPLACE VIEW vw_alunos_detalhados AS
SELECT 
    a.id,
    a.nome,
    a.matricula,
    a.turma,
    a.serie,
    a.turno,
    a.status,
    a.email,
    a.cpf,
    a.data_nascimento,
    a.responsavel,
    a.responsavel_financeiro,
    a.responsavel_pedagogico,
    a.telefone,
    a.inadimplente,
    a.risco_evasao,
    a.foto,
    a.dados,
    a.updated_at,
    a.created_at,
    -- Join flexível com Turmas (pois a.turma pode ser o ID, Código ou Nome)
    t.id AS turma_id,
    t.nome AS turma_nome,
    t.ano AS turma_anoLetivo,
    t.dados->>'segmento' AS turma_segmento,
    -- JSONB Aggregation dos Responsáveis para evitar N+1
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'nome', r.nome,
                    'cpf', r.cpf,
                    'email', r.email,
                    'telefone', r.telefone,
                    'celular', r.celular,
                    'dataNasc', r.data_nasc,
                    'diasAcesso', r.dias_acesso,
                    'parentesco', ar.parentesco,
                    'isFinanceiro', ar.resp_financeiro,
                    'isPedagogico', ar.resp_pedagogico,
                    'isOutro', ar.resp_outro
                )
            )
            FROM public.aluno_responsavel ar
            JOIN public.responsaveis r ON r.id = ar.responsavel_id
            WHERE ar.aluno_id = a.id OR ar.aluno_id = a.matricula OR ar.aluno_id = a.dados->>'codigo'
        ), '[]'::jsonb
    ) AS responsaveis_vinculados
FROM public.alunos a
LEFT JOIN public.turmas t ON 
    t.id::text = a.turma OR 
    t.codigo = a.turma OR 
    t.nome = a.turma;

-- 3. Função para Inserção em Lote de Notas (Transacional e Segura)
CREATE OR REPLACE FUNCTION salvar_notas_em_lote(p_dados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    lanc_record RECORD;
    aluno_record RECORD;
    valor_record RECORD;
    v_lanc_id text;
    v_aluno_id text;
BEGIN
    -- Validação inicial
    IF jsonb_typeof(p_dados) != 'array' THEN
        RAISE EXCEPTION 'Payload deve ser um array JSON';
    END IF;

    -- 1. Itera sobre os lançamentos
    FOR lanc_record IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrai ou gera ID do Lançamento
        v_lanc_id := COALESCE(lanc_record.value->>'id', 'LN-' || (extract(epoch from now()) * 1000)::bigint::text || '-' || substring(md5(random()::text) from 1 for 4));
        
        -- Ignora se faltarem campos obrigatórios
        IF lanc_record.value->>'turmaId' IS NULL OR lanc_record.value->>'disciplina' IS NULL OR lanc_record.value->>'bimestre' IS NULL THEN
            CONTINUE;
        END IF;

        -- Upsert Lançamento
        INSERT INTO academico_notas_lancamento (
            id, turma_id, disciplina, bimestre, esquema_id, criado_por, created_at
        ) VALUES (
            v_lanc_id,
            lanc_record.value->>'turmaId',
            lanc_record.value->>'disciplina',
            lanc_record.value->>'bimestre',
            lanc_record.value->>'esquemaId',
            COALESCE(lanc_record.value->>'criadoPor', 'Usuário'),
            COALESCE((lanc_record.value->>'createdAt')::timestamp, now())
        )
        ON CONFLICT (id) DO UPDATE SET
            turma_id = EXCLUDED.turma_id,
            disciplina = EXCLUDED.disciplina,
            bimestre = EXCLUDED.bimestre,
            esquema_id = EXCLUDED.esquema_id,
            criado_por = EXCLUDED.criado_por;

        -- 2. Itera sobre os alunos deste lançamento
        IF jsonb_typeof(lanc_record.value->'notas') = 'array' THEN
            FOR aluno_record IN SELECT * FROM jsonb_array_elements(lanc_record.value->'notas')
            LOOP
                IF aluno_record.value->>'alunoId' IS NULL THEN
                    CONTINUE;
                END IF;

                v_aluno_id := v_lanc_id || '_' || (aluno_record.value->>'alunoId');

                -- Upsert Aluno Nota
                INSERT INTO academico_notas_aluno (
                    id, lancamento_id, aluno_id, media_parcial, faltas, situacao
                ) VALUES (
                    v_aluno_id,
                    v_lanc_id,
                    aluno_record.value->>'alunoId',
                    aluno_record.value->>'mediaParcial',
                    COALESCE((aluno_record.value->>'faltas')::integer, 0),
                    COALESCE(aluno_record.value->>'situacao', '')
                )
                ON CONFLICT (id) DO UPDATE SET
                    media_parcial = EXCLUDED.media_parcial,
                    faltas = EXCLUDED.faltas,
                    situacao = EXCLUDED.situacao;

                -- 3. Itera sobre os valores detalhados deste aluno
                IF jsonb_typeof(aluno_record.value->'valores') = 'object' THEN
                    FOR valor_record IN SELECT * FROM jsonb_each_text(aluno_record.value->'valores')
                    LOOP
                        IF valor_record.value IS NOT NULL AND valor_record.value != '' THEN
                            -- Upsert Valor
                            INSERT INTO academico_notas_valor (
                                id, nota_aluno_id, detalhe_id, valor
                            ) VALUES (
                                v_aluno_id || '_' || valor_record.key,
                                v_aluno_id,
                                valor_record.key,
                                valor_record.value
                            )
                            ON CONFLICT (id) DO UPDATE SET
                                valor = EXCLUDED.valor;
                        END IF;
                    END LOOP;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;
