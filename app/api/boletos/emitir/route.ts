/**
 * app/api/boletos/emitir/route.ts
 * POST /api/boletos/emitir
 * Pipeline completo de emissão de boleto — SERVER-SIDE ONLY
 */
import { NextRequest, NextResponse } from 'next/server'
import { validarEmissao } from '@/lib/banking/validacao'
import { gerarNossoNumeroItau } from '@/lib/banking/nossoNumero'
import { gerarCodigoBarrasCompleto } from '@/lib/banking/codigoBarras'
import { gerarLinhaDigitavelFormatada } from '@/lib/banking/linhaDigitavel'
import { gerarHTMLBoleto } from '@/lib/banking/boletoTemplate'
import type { TituloEmissaoInput, ConvenioBancario, BoletoCompleto } from '@/lib/banking/types'

/** Normaliza agência para exatamente 4 dígitos */
function normAgencia(ag: string): string {
  return (ag || '').replace(/\D/g, '').padStart(4, '0').slice(0, 4)
}

/**
 * Normaliza conta para exatamente 5 dígitos SEM o dígito verificador.
 * 
 * O campo livre do Itaú espera 5 dígitos da conta (sem DV).
 * O DV vai separado na posição [22] do campo livre via calcDvAgenciaContaItau.
 * 
 * Estratégia:
 *   1. Se 'digitoConta' for informado, assume que 'conta' NÃO tem o DV —
 *      apenas normaliza para 5 dígitos.
 *   2. Se 'conta' tem 6+ dígitos E 'digitoConta' é o último dígito da conta,
 *      remove o último dígito antes de normalizar.
 *   3. Fallback: pega os primeiros 5 dígitos (não os últimos).
 */
function normConta(cc: string, digitoConta?: string): string {
  const digits = (cc || '').replace(/\D/g, '')
  // Se a conta veio com 6 dígitos e o último é o DV conhecido: remove o DV
  if (digits.length === 6 && digitoConta && digits.endsWith(digitoConta)) {
    return digits.slice(0, 5)
  }
  // Se tem mais de 5 dígitos por qualquer razão: pega os primeiros 5
  return digits.padStart(5, '0').slice(0, 5)
}


/** Trunca instrução ao limite de 80 chars */
function truncInst(s: string | undefined): string {
  if (!s) return ''
  return s.slice(0, 80)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      titulo: TituloEmissaoInput
      convenio: ConvenioBancario
      ultimoSequencial?: number
    }

    const { titulo: rawTitulo, convenio: rawConvenio, ultimoSequencial = 0 } = body

    if (!rawTitulo || !rawConvenio) {
      return NextResponse.json({
        sucesso: false,
        erros: ['Dados incompletos: titulo e convenio são obrigatórios'],
      }, { status: 400 })
    }

    // ── Normalização preventiva dos dados ─────────────────────────────────
    const convenio: ConvenioBancario = {
      ...rawConvenio,
      agencia: normAgencia(rawConvenio.agencia),
      // Passa digitoConta para que normConta possa remover o DV caso esteja embutido
      conta: normConta(rawConvenio.conta, rawConvenio.digitoConta),
      cnpj: (rawConvenio.cnpj || '').replace(/\D/g, ''),
    }

    // Garante CPF/CNPJ sem pontuação e fallback se for apenas zeros
    const cpfCnpjRaw = (rawTitulo.pagador?.cpfCnpj || '').replace(/\D/g, '')
    const cpfCnpjNorm = cpfCnpjRaw === '00000000000' || cpfCnpjRaw === '00000000000000' || !cpfCnpjRaw
      ? '00000000191' // CPF fictício válido usado como placeholder bancário
      : cpfCnpjRaw

    const titulo: TituloEmissaoInput = {
      ...rawTitulo,
      pagador: {
        ...rawTitulo.pagador,
        // String() coercion garante que nunca chega um não-string para validacao.ts/cnab400.ts
        nome:        String(rawTitulo.pagador?.nome        || rawTitulo.alunoNome    || 'A INFORMAR'),
        cpfCnpj:     cpfCnpjNorm,
        logradouro:  String(rawTitulo.pagador?.logradouro  || 'A INFORMAR'),
        numero:      String(rawTitulo.pagador?.numero       || 'S/N'),
        bairro:      String(rawTitulo.pagador?.bairro       || 'A INFORMAR'),
        cidade:      String(rawTitulo.pagador?.cidade       || 'A INFORMAR'),
        uf:          String(rawTitulo.pagador?.uf           || 'SP').slice(0, 2).toUpperCase() || 'SP',
        cep:         String(rawTitulo.pagador?.cep          || '').replace(/\D/g, '').padStart(8, '0') || '01310100',
        complemento: String(rawTitulo.pagador?.complemento  || ''),
      },
      // Trunca instruções para o limite bancário de 80 chars
      instrucao1: truncInst(rawTitulo.instrucao1),
      instrucao2: truncInst(rawTitulo.instrucao2),
      // Número do documento: gera automaticamente se vazio
      numeroDocumento: rawTitulo.numeroDocumento?.trim() || `DOC-${Date.now()}`,
      // Garante espécie válida
      especie: rawTitulo.especie || 'DS',
      aceite: rawTitulo.aceite || 'N',
      // Defaults de encargos
      desconto: rawTitulo.desconto ?? 0,
      abatimento: rawTitulo.abatimento ?? 0,
      percJuros: rawTitulo.percJuros ?? 0.033,
      percMulta: rawTitulo.percMulta ?? 2,
      diasProtesto: rawTitulo.diasProtesto ?? 0,
      tipoProtesto: rawTitulo.tipoProtesto || '0',
    }

    // ── 1. Validação ────────────────────────────────────────────────────────
    const validacao = validarEmissao(titulo, convenio)
    if (!validacao.valido) {
      return NextResponse.json({
        sucesso: false,
        erros: validacao.erros,
        avisos: validacao.avisos,
      }, { status: 422 })
    }

    // ── 2. Gerar Nosso Número ───────────────────────────────────────────────
    const nn = gerarNossoNumeroItau(ultimoSequencial, convenio.carteira)

    // ── 3. Código de Barras 44 dígitos ─────────────────────────────────────
    const cb = gerarCodigoBarrasCompleto({
      banco: convenio.banco,
      carteira: convenio.carteira,
      nossoNumero: nn.nossoNumero,
      agencia: convenio.agencia,
      conta: convenio.conta,
      dataVencimento: titulo.dataVencimento,
      valor: titulo.valor,
    })

    // ── 4. Linha Digitável ─────────────────────────────────────────────────
    const ld = gerarLinhaDigitavelFormatada(cb.codigoBarras44)

    // ── 5. Boleto completo ─────────────────────────────────────────────────
    const boletoCompleto: BoletoCompleto = {
      nossoNumero: nn.nossoNumero,
      nossoNumeroDV: nn.dvNossoNumero,
      nossoNumeroFormatado: nn.nossoNumeroFormatado,
      codigoBarras44: cb.codigoBarras44,
      linhaDigitavel: ld.linhaRaw,
      linhaDigitavelFormatada: ld.linhaFormatada,
      fatorVencimento: cb.fatorVencimento,
      campoLivre: cb.campoLivre,
      payload: titulo,
      convenio,
      geradoEm: new Date().toISOString(),
    }

    // ── 6. HTML do boleto ──────────────────────────────────────────────────
    const htmlBoleto = gerarHTMLBoleto(boletoCompleto)

    // ── 7. Evento de auditoria ─────────────────────────────────────────────
    const evento = {
      id: `EVT-${Date.now()}`,
      data: new Date().toISOString(),
      tipo: 'emissao' as const,
      descricao: `Boleto emitido — NN ${nn.nossoNumeroFormatado} — Valor R$ ${titulo.valor.toFixed(2).replace('.', ',')}`,
      payload: JSON.stringify({
        codigoBarras44: cb.codigoBarras44,
        linhaDigitavel: ld.linhaRaw,
        nossoNumero: nn.nossoNumero,
        convenioId: convenio.id,
        valor: titulo.valor,
      }),
    }

    // ── 8. Resposta ────────────────────────────────────────────────────────
    return NextResponse.json({
      sucesso: true,
      avisos: validacao.avisos,
      dados: {
        nossoNumero: nn.nossoNumero,
        nossoNumeroDV: nn.dvNossoNumero,
        nossoNumeroFormatado: nn.nossoNumeroFormatado,
        novoSequencial: nn.sequencial,
        codigoBarras44: cb.codigoBarras44,
        dvNossoNumero: cb.dvNossoNumero,
        dvAgenciaConta: cb.dvAgenciaConta,
        campoLivre: cb.campoLivre,
        fatorVencimento: cb.fatorVencimento,
        linhaDigitavel: ld.linhaRaw,
        linhaDigitavelFormatada: ld.linhaFormatada,
        campos: ld.campos,
        htmlBoleto,
        evento,
        geradoEm: boletoCompleto.geradoEm,
      },
    })

  } catch (err) {
    console.error('[API /boletos/emitir]', err)
    return NextResponse.json({
      sucesso: false,
      erros: [`Erro interno na emissão: ${(err as Error).message}`],
    }, { status: 500 })
  }
}
