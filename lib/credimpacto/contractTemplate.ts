// ==============================================================================
// Gerador de Contrato de Mútuo Financeiro e Termo de Autorização de Desconto em Folha
// Em conformidade com a legislação trabalhista brasileira (CLT arts. 462 e 477)
// ==============================================================================

import { CredImpactoEmprestimo } from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS } from './engine'

export const DEFAULT_TERMO_AUTORIZACAO =
  'Com fulcro no artigo 462, caput, da Consolidação das Leis do Trabalho (CLT) e na Súmula nº 342 do Tribunal Superior do Trabalho (TST), o(a) DEVEDOR(A), de forma livre, espontânea, expressa e irrevogável, AUTORIZA a empregadora a efetuar o desconto mensal das parcelas discriminadas na folha de pagamento de seus salários e/ou remunerações, observada a competência mensal de cada prestação.'

export function generateContractHtml(
  loan: CredImpactoEmprestimo,
  options?: {
    razaoSocialEscola?: string
    nomeFantasiaEscola?: string
    cnpjEscola?: string
    enderecoEscola?: string
    cidadeUfEscola?: string
    unidadeEscola?: string
    termoAutorizacaoDesconto?: string
  }
): string {
  const escola = {
    razaoSocial: options?.razaoSocialEscola || 'Colegio Impacto Centro de Ensino LTDA',
    nomeFantasia: options?.nomeFantasiaEscola || options?.unidadeEscola || loan.colaboradorUnidade || 'Colegio Impacto de Ef',
    cnpj: options?.cnpjEscola || '04.395.789/0001-88',
    endereco: options?.enderecoEscola || 'Rua Alagoas, nº 1081, Bairro Jardim dos Estados',
    cidadeUf: options?.cidadeUfEscola || 'Campo Grande - MS • CEP: 79020-121'
  }

  const metodoInfo = METODOS_LABELS[loan.metodoCalculo] || {
    nome: loan.metodoCalculo,
    descricao: ''
  }

  const textoAutorizacao =
    loan.termoAutorizacaoDesconto ||
    options?.termoAutorizacaoDesconto ||
    DEFAULT_TERMO_AUTORIZACAO

  const parcelasHtml = (loan.parcelas || [])
    .map(
      (p) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
      <td style="padding: 6px 10px; text-align: center; font-weight: bold;">${p.numero}/${loan.quantidadeParcelas}</td>
      <td style="padding: 6px 10px; text-align: center;">${p.competencia}</td>
      <td style="padding: 6px 10px; text-align: center;">${new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}</td>
      <td style="padding: 6px 10px; text-align: right;">${formatBrl(p.valorAmortizacao)}</td>
      <td style="padding: 6px 10px; text-align: right; color: #64748b;">${formatBrl(p.valorJuros)}</td>
      <td style="padding: 6px 10px; text-align: right; font-weight: bold; color: #0f172a;">${formatBrl(p.valorTotal)}</td>
      <td style="padding: 6px 10px; text-align: right; color: #0284c7;">${formatBrl(p.saldoDevedorApos)}</td>
    </tr>
  `
    )
    .join('')

  return `
<div style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; line-height: 1.6; max-width: 820px; margin: 0 auto; padding: 24px; background: #ffffff;">
  
  <!-- CABEÇALHO OFICIAL DA UNIDADE ESCOLAR -->
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
    <div style="font-size: 19px; font-weight: 900; letter-spacing: 0.04em; color: #0f172a; text-transform: uppercase;">
      ${escola.razaoSocial}
    </div>
    ${escola.nomeFantasia && escola.nomeFantasia.toLowerCase() !== escola.razaoSocial.toLowerCase() ? `
      <div style="font-size: 13px; font-weight: 700; color: #0284c7; margin-top: 2px;">
        ${escola.nomeFantasia}
      </div>
    ` : ''}
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
      CNPJ: ${escola.cnpj} • ${escola.endereco} • ${escola.cidadeUf}
    </div>
    <div style="margin-top: 14px; font-size: 15px; font-weight: 800; background: #f1f5f9; padding: 6px 12px; border-radius: 6px; display: inline-block; color: #0f172a; letter-spacing: 0.03em;">
      INSTRUMENTO PARTICULAR DE MÚTUO FINANCEIRO E AUTORIZAÇÃO DE DESCONTO EM FOLHA
    </div>
    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
      OPERACÃO Nº: <strong>${loan.codigoOperacao}</strong>
    </div>
  </div>

  <!-- IDENTIFICAÇÃO DAS PARTES -->
  <div style="margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
    <div style="font-weight: bold; font-size: 13px; text-transform: uppercase; color: #334155; margin-bottom: 8px;">1. DAS PARTES</div>
    <p style="font-size: 13px; margin: 4px 0;">
      <strong>CREDORA / EMPREGADORA:</strong> <strong>${escola.razaoSocial}</strong>${escola.nomeFantasia && escola.nomeFantasia.toLowerCase() !== escola.razaoSocial.toLowerCase() ? ` (${escola.nomeFantasia})` : ''}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>${escola.cnpj}</strong>, com sede em ${escola.endereco}, ${escola.cidadeUf}.
    </p>
    <p style="font-size: 13px; margin: 4px 0;">
      <strong>DEVEDOR(A) / COLABORADOR(A):</strong> <strong>${loan.colaboradorNome}</strong>, inscrito(a) no CPF/MF sob o nº <strong>${loan.colaboradorCpf || 'Pendente de preenchimento'}</strong>, exercendo na instituição a função de <strong>${loan.colaboradorCargo || 'Colaborador(a)'}</strong>${loan.colaboradorUnidade ? `, lotado(a) na unidade <strong>${loan.colaboradorUnidade}</strong>` : ''}, matrícula <strong>${loan.colaboradorMatricula || 'N/A'}</strong>.
    </p>
  </div>

  <!-- CLÁUSULA PRIMEIRA - OBJETO E VALOR -->
  <div style="margin-bottom: 18px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CLÁUSULA PRIMEIRA – DO OBJETO E VALOR CONCEDIDO</div>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0;">
      A <strong>CREDORA</strong> concede ao(à) <strong>DEVEDOR(A)</strong>, nesta data, a título de empréstimo financeiro, a quantia líquida de <strong>${formatBrl(loan.valorAprovado)}</strong>${loan.finalidade ? ` (Finalidade declarada: <strong>${loan.finalidade}</strong>)` : ''}, a ser creditada na conta bancária de titularidade do(a) colaborador(a) indicada na proposta${loan.dadosBancarios?.chavePix && !loan.dadosBancarios.chavePix.toLowerCase().includes('definir') ? ` (Chave PIX cadastrada: <strong>${loan.dadosBancarios.chavePix}</strong>${loan.dadosBancarios.tipoChavePix ? ` • ${loan.dadosBancarios.tipoChavePix.toUpperCase()}` : ''})` : ''}.
    </p>
    ${loan.justificativaSolicitacao ? `
    <p style="font-size: 12px; color: #475569; margin: 4px 0; font-style: italic;">
      • Justificativa ou Observações: &ldquo;${loan.justificativaSolicitacao}&rdquo;
    </p>
    ` : ''}
  </div>

  <!-- CLÁUSULA SEGUNDA - TAXA E MÉTODO DE CÁLCULO -->
  <div style="margin-bottom: 18px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CLÁUSULA SEGUNDA – DOS JUROS, PRAZO E AMORTIZAÇÃO</div>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0;">
      Sobre o montante mutuado incidirá a taxa de juros de <strong>${loan.taxaMensal.toFixed(2)}% ao mês</strong>, adotando-se o método de amortização: <strong>${metodoInfo.nome}</strong>.
    </p>
    <div style="background: #f1f5f9; padding: 8px 12px; border-left: 3px solid #0284c7; font-size: 12px; margin-bottom: 6px;">
      <em>${metodoInfo.descricao}</em>
    </div>
    <p style="font-size: 13px; margin: 4px 0;">
      • Valor Principal Amortizável: <strong>${formatBrl(loan.valorAprovado)}</strong><br/>
      • Total de Juros Previstos no Prazo: <strong>${formatBrl(loan.totalJuros)}</strong><br/>
      • Total a Pagar no Vencimento Integral: <strong>${formatBrl(loan.totalAPagar)}</strong><br/>
      • Quantidade de Parcelas Mensais: <strong>${loan.quantidadeParcelas}</strong>
    </p>
  </div>

  <!-- CLÁUSULA TERCEIRA - AUTORIZAÇÃO DE DESCONTO EM FOLHA -->
  <div style="margin-bottom: 18px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CLÁUSULA TERCEIRA – DA AUTORIZAÇÃO EXPRESSA DE DESCONTO EM FOLHA (CLT ART. 462)</div>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0; white-space: pre-line;">
      ${textoAutorizacao}
    </p>
  </div>

  <!-- CRONOGRAMA DE PARCELAS -->
  <div style="margin-bottom: 20px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CRONOGRAMA DE PARCELAS E COMPETÊNCIAS</div>
    <table style="width: 100%; border-collapse: collapse; margin-top: 6px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
          <th style="padding: 7px 10px; text-align: center;">Parcela</th>
          <th style="padding: 7px 10px; text-align: center;">Competência</th>
          <th style="padding: 7px 10px; text-align: center;">Vencimento</th>
          <th style="padding: 7px 10px; text-align: right;">Amortização</th>
          <th style="padding: 7px 10px; text-align: right;">Juros</th>
          <th style="padding: 7px 10px; text-align: right;">Valor Parcela</th>
          <th style="padding: 7px 10px; text-align: right;">Saldo Restante</th>
        </tr>
      </thead>
      <tbody>
        ${parcelasHtml}
      </tbody>
    </table>
  </div>

  <!-- CLÁUSULA QUARTA - QUITAÇÃO ANTECIPADA -->
  <div style="margin-bottom: 18px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CLÁUSULA QUARTA – DA LIQUIDAÇÃO E QUITAÇÃO ANTECIPADA</div>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0;">
      É assegurado ao(à) <strong>DEVEDOR(A)</strong> o direito à liquidação antecipada do débito, total ou parcial, mediante abatimento proporcional e integral de todos os juros futuros vincendos não incorridos. Para tanto, o saldo devedor para liquidação imediata corresponderá exclusivamente ao saldo do principal ainda não amortizado.
    </p>
  </div>

  <!-- CLÁUSULA QUINTA - RESCISÃO DO CONTRATO DE TRABALHO -->
  <div style="margin-bottom: 18px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CLÁUSULA QUINTA – DO DESLIGAMENTO E RESCISÃO CONTRATUAL (ART. 477 DA CLT)</div>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0;">
      Em caso de cessação do vínculo empregatício por qualquer motivo (demissão sem justa causa, com justa causa, pedido de demissão ou acordo mútuo), o saldo devedor remanescente vencerá antecipadamente.
    </p>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0;">
      Fica autorizada a compensação de débitos no Termo de Rescisão do Contrato de Trabalho (TRCT), <strong>respeitado estritamente o limite legal estabelecido no art. 477, § 5º da CLT</strong> (equivalente a 1 mês de remuneração do colaborador). Caso o saldo devedor remanescente supere referido teto, o saldo excedente continuará devido e será objeto de ajuste à parte ou instrumento de confissão de dívida para pagamento avulso.
    </p>
  </div>

  <!-- CLÁUSULA SEXTA - VALIDADE DA ASSINATURA ELETRÔNICA -->
  <div style="margin-bottom: 24px;">
    <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 6px;">CLÁUSULA SEXTA – DA ASSINATURA ELETRÔNICA E EVIDÊNCIAS DE ACEITE</div>
    <p style="font-size: 13px; text-align: justify; margin: 0 0 6px 0;">
      As partes declaram plenamente válido o presente instrumento assinado por meio eletrônico, em conformidade com o art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e com a Lei Federal nº 14.063/2020, reconhecendo como válidos os registros computacionais, código de verificação, endereço IP, carimbo de data/hora e hash criptográfico gerados pelo sistema <strong>Impacto EDU / CredImpacto</strong>.
    </p>
  </div>

  <!-- CARIMBO DE ASSINATURA ELETRÔNICA -->
  <div style="border: 2px dashed #0284c7; background: #f0f9ff; border-radius: 8px; padding: 16px; margin-top: 24px;">
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #bae6fd; padding-bottom: 8px; margin-bottom: 10px;">
      <div style="font-size: 13px; font-weight: 800; color: #0369a1; text-transform: uppercase;">
        Evidências da Assinatura Eletrônica Verificada
      </div>
      <div style="font-size: 11px; font-weight: bold; background: #0284c7; color: #ffffff; padding: 2px 8px; border-radius: 4px;">
        ${loan.assinadoEm ? 'DOCUMENTO ASSINADO E VÁLIDO' : 'AGUARDANDO ASSINATURA'}
      </div>
    </div>

    ${
      loan.assinadoEm
        ? `
      <div style="font-size: 12px; color: #0f172a; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div><strong>Assinante:</strong> ${loan.colaboradorNome}</div>
        <div><strong>CPF:</strong> ${loan.colaboradorCpf}</div>
        <div><strong>Chave PIX Informada:</strong> ${loan.dadosBancarios?.chavePix || 'Pendente'} ${loan.dadosBancarios?.tipoChavePix ? `(${loan.dadosBancarios.tipoChavePix.toUpperCase()})` : ''}</div>
        <div><strong>Data e Hora (Local):</strong> ${new Date(loan.assinadoEm).toLocaleString('pt-BR')}</div>
        <div><strong>Endereço IP:</strong> ${loan.assinanteIp || 'Registrado no servidor'}</div>
        <div><strong>Código de Validação:</strong> <code style="font-weight: bold; color: #0369a1;">${loan.codigoVerificacaoAssinatura || 'N/A'}</code></div>
      </div>
      <div style="margin-top: 10px; font-size: 11px; color: #475569; word-break: break-all;">
        <strong>Hash Criptográfico SHA-256:</strong><br/>
        <code style="background: #e0f2fe; padding: 2px 6px; border-radius: 4px; color: #0284c7; font-family: monospace;">${loan.contratoHashSha256 || 'Em validação'}</code>
      </div>
    `
        : `
      <div style="font-size: 12px; color: #64748b; text-align: center; padding: 12px 0;">
        Este documento aguarda a assinatura eletrônica do colaborador com validação de senha e geração de hash SHA-256.
      </div>
    `
    }
  </div>

  <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
    Documento emitido pelo módulo CredImpacto • Sistema de Gestão Escolar Integrada Impacto EDU
  </div>
</div>
`
}
