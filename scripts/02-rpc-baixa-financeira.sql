-- =========================================================================================
-- FASE B: INJEÇÃO DA TRANSACTION FAANG
-- Execute este script no SQL Editor do Supabase (Aba SQL)
--
-- O QUE ISSO FAZ?
-- Impede Duplicidade e Erro de Conexão. Ao invés do Frontend disparar 2 inserts separados 
-- (um na parcela, outro no caixa), esta "Remote Procedure Call" (RPC) fará amarrado:
-- Se o caixa falhar, a parcela volta a ficar "Pendente" automaticamente (ROOLBACK).
-- =========================================================================================

CREATE OR REPLACE FUNCTION fn_realizar_baixa(
    p_parcela_id UUID,
    p_caixa_id TEXT,
    p_valor_recebido DECIMAL(12, 2),
    p_operador TEXT,
    p_forma_pagamento TEXT,
    p_plano_contas_id TEXT,
    p_descricao TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Roda ignorando limitações rls client momentaneamente (pois a api router assumirá o controle de autorização)
AS $$
DECLARE
    v_parcela_status VARCHAR;
    v_caixa_status BOOLEAN;
    v_novo_id_movimentacao TEXT;
BEGIN
    -- 1. Verifica se a Parcela existe e se JÁ não está paga
    SELECT status INTO v_parcela_status FROM public.fin_parcelas WHERE id = p_parcela_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'A Parcela solicitada não foi encontrada no banco relacional.';
    END IF;

    IF v_parcela_status = 'pago' THEN
        RAISE EXCEPTION 'DUPLICIDADE RECUSADA: Esta parcela já consta como Paga no banco.';
    END IF;

    -- 2. Verifica se o Caixa Destino existe e se ESTÁ ABERTO
    SELECT fechado INTO v_caixa_status FROM public.caixas WHERE id = p_caixa_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'O Caixa informado não existe.';
    END IF;

    IF v_caixa_status = TRUE THEN
        RAISE EXCEPTION 'O Caixa especificado já está fechado e não pode receber movimentações.';
    END IF;

    -- 3. Atualiza o status da parcela com o real timestamp do banco 
    UPDATE public.fin_parcelas
    SET 
        valor_pago = p_valor_recebido,
        data_pagamento = CURRENT_DATE,
        caixa_id = p_caixa_id,
        status = 'pago',
        responsavel_pagamento = p_operador
    WHERE id = p_parcela_id;

    -- 4. Cria a Movimentação correspondente ("O Lastro Fiscal")
    v_novo_id_movimentacao := 'MV-' || to_char(now(), 'YYYYMMDDHH24MISSMS');
    
    INSERT INTO public.movimentacoes (
        id, caixa_id, tipo, valor, descricao, data, hora, 
        operador, plano_contas_id, compensado_banco, origem, referencia_id
    ) VALUES (
        v_novo_id_movimentacao, p_caixa_id, 'entrada', p_valor_recebido, 
        COALESCE(p_descricao, 'Recebimento de Mensalidade'), 
        to_char(CURRENT_DATE, 'YYYY-MM-DD'), 
        to_char(now(), 'HH24:MI'), 
        p_operador, p_plano_contas_id, 
        p_forma_pagamento, 'baixa_aluno', p_parcela_id::text
    );

    -- Tudo deu certo! PostgreSQL executa o COMMIT Automaticamente no retorno.
    RETURN jsonb_build_object(
        'sucesso', true,
        'mensagem', 'Baixa consolidada sob a transação MV: ' || v_novo_id_movimentacao,
        'movimentacao_id', v_novo_id_movimentacao
    );

EXCEPTION WHEN OTHERS THEN
    -- Erro capturado, PostgreSQL executa ROLLBACK AUTOMÁTICO de tudo que rolou acima.
    RAISE EXCEPTION 'FALHA NA TRANSAÇÃO SQL: %', SQLERRM;
END;
$$;
