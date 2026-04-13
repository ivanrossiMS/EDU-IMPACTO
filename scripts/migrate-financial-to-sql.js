const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parser nativo (evita quebrar por falta de lib 'dotenv' isolada)
try {
  const envPath = path.resolve(__dirname, '../.env.local');
  const fileContent = fs.readFileSync(envPath, 'utf-8');
  fileContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
} catch(e) { console.log('Não foi possível ler .env.local, tentando env default...'); }
  
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Erro: Chaves do Supabase não encontradas no .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrarBanco() {
  console.log("⚡ [FASE A] Iniciando extração de JSONB Alunos -> fin_eventos / fin_parcelas...");

  // 1. Busca todos alunos que tem histórico json
  const { data: alunos, error: fetchErr } = await supabase
    .from('alunos')
    .select('id, nome, dados');

  if (fetchErr) {
    console.error("❌ Falha na leitura dos alunos:", fetchErr.message);
    process.exit(1);
  }

  console.log(`✅ ${alunos.length} alunos detectados.`);
  let eventosCriados = 0;
  let parcelasCriadas = 0;

  for (const aluno of alunos) {
    const dados = aluno.dados || {};
    const eventosAgrupados = dados.eventosFinanceiros || [];

    for (const evento of eventosAgrupados) {
      if (!evento.id) continue;

      // Montar payload do Evento (Matrícula, Etc)
      const novoEvento = {
        aluno_id: aluno.id, // Foreign Key Relacional Oficial
        tipo: evento.detalheCurso ? 'matricula' : 'extra', 
        descricao: evento.descricao || 'Receita Diversa',
        plano_contas_id: evento.planoContasId || null,
        valor_total: Number(evento.valorOriginal || 0),
        qtde_parcelas: evento.parcelas ? evento.parcelas.length : 1,
        status: evento.status || 'ativo',
        dados_legados: evento, // O backup pra caso dê M.
      };

      // Inserir Tabela Mestra (fin_eventos)
      const { data: insertedEvento, error: evErr } = await supabase
        .from('fin_eventos')
        .insert(novoEvento)
        .select()
        .single();

      if (evErr) {
        console.error(`⚠️ Erro inserindo evento ${evento.id} do Aluno ${aluno.nome}:`, evErr.message);
        continue;
      }
      eventosCriados++;

      // Inserir Filhos Relacionais (fin_parcelas)
      const parcelasNoJson = evento.parcelas || [];
      if (parcelasNoJson.length > 0) {
        const payloadParcelas = parcelasNoJson.map((p, idx) => ({
          evento_id: insertedEvento.id,
          numero_parcela: p.num || idx + 1,
          descricao: p.descricao || `${novoEvento.descricao} (${p.num}/${parcelasNoJson.length})`,
          vencimento: p.vencimento || new Date().toISOString().split('T')[0],
          valor_original: Number(p.valor || 0),
          desconto: Number(p.desconto || 0),
          juros: Number(p.juros || 0),
          multa: Number(p.multa || 0),
          valor_pago: (p.status === 'pago' || p.valorPago > 0) ? Number(p.valorPago || p.valor) : null,
          data_pagamento: p.dataPagamento || null,
          status: p.status || 'pendente',
          dados_legados: p,
        }));

        const { error: plErr } = await supabase.from('fin_parcelas').insert(payloadParcelas);
        if (plErr) {
            console.error(`⚠️ Erro inserindo parcelas no evento ${insertedEvento.id}:`, plErr.message);
        } else {
            parcelasCriadas += payloadParcelas.length;
        }
      }
    }
  }

  console.log(`\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`   - Eventos Extraídos: ${eventosCriados}`);
  console.log(`   - Parcelas Relacionais Geradas: ${parcelasCriadas}`);
  console.log(`\nO JSONB da tabela de alunos continuou intocado por segurança para o Front-end antigo funcionar até a Fase C.`);
}

migrarBanco();
