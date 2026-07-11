-- Função RPC para criar Comunicado e Cobrança em uma transação atômica
-- Executar no painel SQL do Supabase.

CREATE OR REPLACE FUNCTION insert_comunicado_com_cobranca(
    p_comunicado jsonb,
    p_cobranca jsonb,
    p_destinatarios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_comunicado_id text;
    v_cobranca_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Inserir o Comunicado
    INSERT INTO comunicados (
        id, titulo, texto, autor, data, destino, fixado, dados, updated_at
    ) VALUES (
        p_comunicado->>'id',
        p_comunicado->>'titulo',
        p_comunicado->>'texto',
        p_comunicado->>'autor',
        (p_comunicado->>'data')::timestamp with time zone,
        p_comunicado->>'destino',
        (p_comunicado->>'fixado')::boolean,
        (p_comunicado->'dados')::jsonb,
        now()
    )
    RETURNING id INTO v_comunicado_id;

    -- 2. Inserir a Cobrança se existir
    IF p_cobranca IS NOT NULL THEN
        INSERT INTO agenda_cobrancas (
            comunicado_id, titulo, valor, vencimento
        ) VALUES (
            v_comunicado_id,
            p_cobranca->>'titulo',
            (p_cobranca->>'valor')::numeric,
            (p_cobranca->>'vencimento')::date
        )
        RETURNING id INTO v_cobranca_id;

        -- 3. Inserir Destinatários da Cobrança
        IF p_destinatarios IS NOT NULL AND jsonb_array_length(p_destinatarios) > 0 THEN
            INSERT INTO agenda_cobrancas_destinatarios (
                cobranca_id, destinatario_id, destinatario_nome, status
            )
            SELECT
                v_cobranca_id,
                obj->>'destinatario_id',
                obj->>'destinatario_nome',
                'PENDING'
            FROM jsonb_array_elements(p_destinatarios) AS obj;
        END IF;
    END IF;

    -- Montar o retorno (comunicado salvo)
    SELECT row_to_json(c)::jsonb INTO v_result
    FROM comunicados c
    WHERE id = v_comunicado_id;

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Qualquer erro faz rollback da transação inteira automaticamente
        RAISE EXCEPTION 'Falha na transação atômica: %', SQLERRM;
END;
$$;
