/**
 * lib/banking/boletoTemplate.ts
 * Template HTML do boleto bancário padrão FEBRABAN
 * SERVER-ONLY — gera HTML puro, A4, pronto para impressão
 */
import type { BoletoCompleto } from './types'
import { formatarCpfCnpj } from './dv'

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtData(iso: string): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/**
 * Gera o CSS do boleto padrão bancário
 * Prioridade: legibilidade, impressão A4, fidelidade FEBRABAN
 */
function gerarCSS(): string {
  return `
    @page { size: A4; margin: 12mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      color: #000;
      background: #fff;
    }
    .boleto-page {
      width: 190mm;
      margin: 0 auto;
    }
    /* ─── Cabeçalho do banco ─── */
    .banco-header {
      display: flex;
      align-items: stretch;
      border: 1px solid #000;
      border-bottom: none;
    }
    .banco-logo {
      padding: 4pt 8pt;
      border-right: 2px solid #000;
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: -1pt;
      min-width: 75pt;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
    }
    .banco-codigo {
      padding: 4pt 8pt;
      border-right: 2px solid #000;
      font-size: 12pt;
      font-weight: 700;
      min-width: 55pt;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .banco-linha-digitavel {
      flex: 1;
      padding: 4pt 8pt;
      font-size: 10pt;
      font-weight: 700;
      font-family: 'Courier New', Courier, monospace;
      letter-spacing: 0.3pt;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    /* ─── Grid de campos ─── */
    .grid-row {
      display: flex;
      border: 1px solid #000;
      border-top: none;
    }
    .campo {
      padding: 2pt 4pt;
      border-right: 1px solid #000;
      flex: 1;
      min-height: 22pt;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    .campo:last-child {
      border-right: none;
    }
    .campo-label {
      font-size: 5.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      color: #000;
      margin-bottom: 2pt;
    }
    .campo-valor {
      font-size: 8.5pt;
      font-weight: 400;
      line-height: 1.2;
    }
    .campo-valor-b {
      font-size: 9pt;
      font-weight: 700;
    }
    .campo-mono {
      font-family: 'Courier New', Courier, monospace;
      font-size: 8.5pt;
    }
    /* ─── Campos fixos de largura ─── */
    .w-venc   { flex: 0 0 78pt; }
    .w-agcod  { flex: 0 0 90pt; }
    .w-datadoc { flex: 0 0 60pt; }
    .w-numdoc  { flex: 0 0 80pt; }
    .w-especie { flex: 0 0 40pt; }
    .w-aceite  { flex: 0 0 28pt; }
    .w-nosso   { flex: 0 0 110pt; }
    .w-carteira { flex: 0 0 55pt; }
    .w-valor   { flex: 0 0 90pt; }
    /* ─── Instruções ─── */
    .instrucoes-row {
      display: flex;
      border: 1px solid #000;
      border-top: none;
      min-height: 55pt;
    }
    .instrucoes-campo {
      flex: 1;
      padding: 3pt 4pt;
      border-right: 1px solid #000;
    }
    .instrucoes-valores {
      flex: 0 0 90pt;
      display: flex;
      flex-direction: column;
    }
    .instrucoes-valores .campo {
      flex: 1;
      border-right: none;
      border-bottom: 1px solid #000;
    }
    .instrucoes-valores .campo:last-child {
      border-bottom: none;
    }
    .instrucoes-text {
      font-size: 7.5pt;
      line-height: 1.6;
      margin-top: 3pt;
    }
    /* ─── Sacado ─── */
    .sacado-row {
      border: 1px solid #000;
      border-top: none;
      padding: 3pt 4pt;
      min-height: 38pt;
    }
    .sacado-label {
      font-size: 5.5pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 2pt;
    }
    .sacado-nome {
      font-size: 9pt;
      font-weight: 700;
    }
    .sacado-end {
      font-size: 7.5pt;
      margin-top: 2pt;
    }
    /* ─── Autenticação mecânica ─── */
    .autenticacao {
      border: 1px solid #000;
      border-top: none;
      padding: 2pt 4pt;
      font-size: 6pt;
      color: #333;
      display: flex;
      justify-content: space-between;
    }
    /* ─── Código de barras ─── */
    .barcode-area {
      margin: 8pt 0 3pt;
      text-align: left;
    }
    .barcode-visual {
      height: 45pt;
      display: flex;
      align-items: stretch;
      gap: 0;
      background: #fff;
    }
    .barcode-below {
      font-size: 9pt;
      font-weight: 700;
      font-family: 'Courier New', Courier, monospace;
      letter-spacing: 0.5pt;
      text-align: center;
      margin-top: 4pt;
    }
    /* ─── Corte ─── */
    .linha-corte {
      border-top: 1px dashed #666;
      margin: 8pt 0 6pt;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8pt;
      font-size: 7pt;
      color: #666;
      padding-top: 3pt;
    }
    /* ─── Print ─── */
    @media print {
      .btn-print { display: none !important; }
      body { background: #fff; }
    }
    .btn-print {
      position: fixed;
      top: 12pt;
      right: 12pt;
      padding: 8pt 18pt;
      background: #003087;
      color: #fff;
      border: none;
      border-radius: 4pt;
      font-size: 11pt;
      font-weight: 700;
      cursor: pointer;
      z-index: 9999;
      font-family: Arial, sans-serif;
    }
    .btn-print:hover { background: #00214f; }
    .via-title {
      font-size: 7pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 1pt;
      text-transform: uppercase;
      margin-bottom: 4pt;
      color: #333;
    }
  `
}

/**
 * Gera código de barras SVG real no padrão Interleaved 2 of 5 (I2/5)
 * Padrão FEBRABAN para boletos bancários — escaneável por leitores reais
 *
 * Codificação I2/5:
 *   - Cada símbolo codifica um PAR de dígitos
 *   - 5 barras (barras escuras) + 5 espaços (entre elas) entrelaçados
 *   - Narrow (N = 1 unidade) e Wide (W = 3 unidades)
 *   - Dígito 0..9 → padrão de 5 {N/W}
 */
function gerarBarrasI25SVG(codigoBarras44: string): string {
  // Tabela I2/5: cada dígito tem 5 elementos (N=1, W=3)
  // Padrão: NNWWN = estreito,estreito,largo,largo,estreito etc.
  const I25: number[][] = [
    [1, 1, 3, 3, 1], // 0
    [3, 1, 1, 1, 3], // 1
    [1, 3, 1, 1, 3], // 2
    [3, 3, 1, 1, 1], // 3
    [1, 1, 3, 1, 3], // 4
    [3, 1, 3, 1, 1], // 5
    [1, 3, 3, 1, 1], // 6
    [1, 1, 1, 3, 3], // 7
    [3, 1, 1, 3, 1], // 8
    [1, 3, 1, 3, 1], // 9
  ]

  // Garante número par de dígitos (I2/5 codifica em pares)
  const digits = codigoBarras44.replace(/\D/g, '')
  const padded = digits.length % 2 === 0 ? digits : '0' + digits

  const N = 1   // unidade narrow
  const W = 3   // unidade wide
  const height = 50 // altura das barras em unidades

  const bars: { x: number; w: number; color: string }[] = []
  let x = 0

  // Guarda de início: NNNN (2 barras pretas + 2 espaços brancos)
  bars.push({ x, w: N, color: '#000' }); x += N
  bars.push({ x, w: N, color: '#fff' }); x += N
  bars.push({ x, w: N, color: '#000' }); x += N
  bars.push({ x, w: N, color: '#fff' }); x += N

  // Codifica cada par de dígitos
  for (let i = 0; i < padded.length; i += 2) {
    const d1 = parseInt(padded[i])
    const d2 = parseInt(padded[i + 1])
    const pat1 = I25[d1] // barras (pretas)
    const pat2 = I25[d2] // espaços (brancos)

    for (let j = 0; j < 5; j++) {
      // Barra preta (do dígito 1)
      bars.push({ x, w: pat1[j], color: '#000' }); x += pat1[j]
      // Espaço branco (do dígito 2)
      bars.push({ x, w: pat2[j], color: '#fff' }); x += pat2[j]
    }
  }

  // Guarda de fim: W N N (largo-barra, estreito-espaço, estreito-barra)
  bars.push({ x, w: W, color: '#000' }); x += W
  bars.push({ x, w: N, color: '#fff' }); x += N
  bars.push({ x, w: N, color: '#000' }); x += N

  const totalWidth = x
  // Gera os retângulos SVG (só as barras pretas precisam ser desenhadas; fundo branco)
  const rects = bars
    .filter(b => b.color === '#000')
    .map(b => `<rect x="${b.x}" y="0" width="${b.w}" height="${height}" fill="#000"/>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="45pt" style="display:block;max-width:190mm">
  <rect width="${totalWidth}" height="${height}" fill="#fff"/>
  ${rects}
</svg>`
}

/**
 * Gera o HTML completo de um boleto bancário padrão FEBRABAN
 * Contém: Ficha de Compensação + Recibo do Pagador
 */
export function gerarHTMLBoleto(payload: BoletoCompleto): string {
  const { pagador, dataVencimento, dataDocumento, descricao, valor,
    especie, aceite, instrucao1, instrucao2, tipoProtesto, diasProtesto,
    percMulta, percJuros, desconto, abatimento, dataLimiteDesconto } = payload.payload

  const convenio = payload.convenio

  const bancoNome = convenio?.nomeBanco || 'BANCO'
  const bancoLogo = convenio?.banco === '341' ? 'ITAÚ' : bancoNome.slice(0, 4).toUpperCase()
  const bancoCod = `${convenio?.banco || '341'}-7`
  const agConv = `${convenio?.agencia || '—'} / ${convenio?.convenio || '—'}`
  const vencFormatado = fmtData(dataVencimento)
  const docFormatado = fmtData(dataDocumento)
  const hoje = fmtData(new Date().toISOString().slice(0, 10))

  // Construção das instruções
  const instrs: string[] = []
  if (instrucao1) instrs.push(instrucao1)
  if (instrucao2) instrs.push(instrucao2)
  if (percMulta) instrs.push(`Multa de ${percMulta}% após o vencimento.`)
  if (percJuros) instrs.push(`Juros de ${percJuros}% ao dia após o vencimento.`)
  if (tipoProtesto && tipoProtesto !== '0') {
    const tp = tipoProtesto === '1' ? 'corridos' : tipoProtesto === '2' ? 'úteis' : ''
    if (tp) instrs.push(`Protestar após ${diasProtesto} dias ${tp}.`)
    else if (tipoProtesto === '3') instrs.push(`Devolver após ${diasProtesto} dias.`)
  }
  if (desconto && dataLimiteDesconto) {
    instrs.push(`Desconto de R$ ${fmtMoeda(desconto)} até ${fmtData(dataLimiteDesconto)}.`)
  }

  // Formatação do pagador
  const pagadorCPFFormatado = formatarCpfCnpj(pagador.cpfCnpj)
  const endLine2 = [pagador.bairro, pagador.complemento].filter(Boolean).join(' — ')
  const endLine3 = `CEP: ${pagador.cep.replace(/(\d{5})(\d{3})/, '$1-$2')} — ${pagador.cidade}/${pagador.uf}`

  // Valores cobrado (valor – desconto + encargos)
  const valorCobrado = valor - (desconto || 0) - (abatimento || 0)

  const barcodeSVG = gerarBarrasI25SVG(payload.codigoBarras44)

  const c = String.raw

  /** Um campo FEBRABAN padrão */
  const campo = (label: string, valor: string, bold = false, mono = false, extraClass = '') =>
    `<div class="campo ${extraClass}">
      <div class="campo-label">${label}</div>
      <div class="${bold ? 'campo-valor-b' : 'campo-valor'}${mono ? ' campo-mono' : ''}">${valor}</div>
    </div>`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Boleto Bancário — ${descricao}</title>
  <style>${gerarCSS()}</style>
</head>
<body>
<button class="btn-print" onclick="window.print()">🖨️ Imprimir Boleto</button>

<div class="boleto-page">

  <!-- ═══════════════════ FICHA DE COMPENSAÇÃO ═══════════════════ -->
  <div class="via-title">Boleto Bancário — Ficha de Compensação — ${convenio?.nomeBanco || 'Banco'}</div>

  <!-- Cabeçalho banco -->
  <div class="banco-header">
    <div class="banco-logo" style="color:${convenio?.banco === '341' ? '#EC7000' : '#003087'}">${bancoLogo}</div>
    <div class="banco-codigo">${bancoCod}</div>
    <div class="banco-linha-digitavel">${payload.linhaDigitavelFormatada}</div>
  </div>

  <!-- Local de pagamento + Vencimento -->
  <div class="grid-row">
    ${campo('Local de Pagamento', 'Pagável em qualquer banco até a data de vencimento. Após o vencimento, pagar somente na agência cedente.')}
    ${campo('Vencimento', vencFormatado, true, false, 'w-venc')}
  </div>

  <!-- Cedente + Ag/Cód Beneficiário -->
  <div class="grid-row">
    ${campo('Cedente (Beneficiário)', convenio?.cedente || '—', true)}
    ${campo('Agência / Cód. Beneficiário', agConv, true, false, 'w-agcod')}
  </div>

  <!-- Data doc / Nº doc / Espécie / Aceite / Data proc / Nosso Número -->
  <div class="grid-row">
    ${campo('Data do Documento', docFormatado, false, false, 'w-datadoc')}
    ${campo('Nº do Documento', payload.payload.numeroDocumento || '—', false, true, 'w-numdoc')}
    ${campo('Espécie', especie || 'REC', false, false, 'w-especie')}
    ${campo('Aceite', aceite || 'N', false, false, 'w-aceite')}
    ${campo('Data do Processamento', hoje)}
    ${campo('Nosso Número', payload.nossoNumeroFormatado, true, true, 'w-nosso')}
  </div>

  <!-- Uso banco / Carteira / Espécie moeda / Qtd / Valor referência / Valor documento -->
  <div class="grid-row">
    ${campo('Uso do Banco', '—')}
    ${campo('Carteira', convenio?.carteira || '109', false, false, 'w-carteira')}
    ${campo('Espécie', 'R$', false, false, 'w-especie')}
    ${campo('Quantidade', '1', false, false, 'w-aceite')}
    ${campo('Valor de Referência', fmtMoeda(valor), false, true)}
    ${campo('(=) Valor do Documento', 'R$ ' + fmtMoeda(valor), true, true, 'w-valor')}
  </div>

  <!-- Instruções + campos de valor -->
  <div class="instrucoes-row">
    <div class="instrucoes-campo">
      <div class="campo-label">Instruções (Texto de responsabilidade do Cedente — máx. 5 linhas)</div>
      <div class="instrucoes-text">${instrs.map(i => `${i}<br>`).join('') || 'Não receber após o vencimento.'}</div>
    </div>
    <div class="instrucoes-valores">
      <div class="campo">
        <div class="campo-label">(-) Desconto / Abatimento</div>
        <div class="campo-valor campo-mono">${(desconto || abatimento) ? 'R$ ' + fmtMoeda((desconto || 0) + (abatimento || 0)) : ''}</div>
      </div>
      <div class="campo">
        <div class="campo-label">(+) Mora / Multa</div>
        <div class="campo-valor campo-mono">&nbsp;</div>
      </div>
      <div class="campo" style="border-bottom:none">
        <div class="campo-label">(=) Valor Cobrado</div>
        <div class="campo-valor-b campo-mono">R$ ${fmtMoeda(Math.max(valorCobrado, 0))}</div>
      </div>
    </div>
  </div>

  <!-- Sacado -->
  <div class="sacado-row">
    <div class="sacado-label">Sacado (Pagador)</div>
    <div class="sacado-nome">${pagador.nome} &nbsp;&nbsp; <span style="font-weight:400;font-size:8pt">CPF/CNPJ: ${pagadorCPFFormatado}</span></div>
    <div class="sacado-end">${pagador.logradouro}, ${pagador.numero}${pagador.complemento ? ' — ' + pagador.complemento : ''}</div>
    <div class="sacado-end">${endLine2}</div>
    <div class="sacado-end">${endLine3}</div>
  </div>

  <!-- Autenticação mecânica -->
  <div class="autenticacao">
    <span>Autenticação Mecânica &nbsp;|&nbsp; FICHA DE COMPENSAÇÃO</span>
    <span>${bancoNome}${convenio?.cnpj ? ' — CNPJ: ' + formatarCpfCnpj(convenio.cnpj) : ''} &nbsp;|&nbsp; Ambiente: ${convenio?.ambiente === 'producao' ? 'Produção' : 'Homologação'}</span>
  </div>

  <!-- Código de barras I2/5 — padrão FEBRABAN -->
  <div class="barcode-area">
    ${barcodeSVG}
    <div class="barcode-below">${payload.linhaDigitavelFormatada}</div>
  </div>

  <!-- Informação técnica (para auditoria) -->
  <div style="font-size:5.5pt;color:#888;text-align:right;margin-top:2pt;font-family:monospace">
    Código de Barras: ${payload.codigoBarras44} &nbsp;|&nbsp; Gerado em: ${new Date(payload.geradoEm).toLocaleString('pt-BR')}
  </div>

  <!-- ═══════════════════ CORTE ═══════════════════ -->
  <div class="linha-corte">✂ &nbsp;&nbsp;&nbsp; Corte aqui — Recibo do Pagador abaixo &nbsp;&nbsp;&nbsp; ✂</div>

  <!-- ═══════════════════ RECIBO DO PAGADOR ═══════════════════ -->
  <div class="via-title">Recibo do Pagador</div>

  <!-- Cabeçalho banco (recibo) -->
  <div class="banco-header" style="border-bottom:none">
    <div class="banco-logo" style="color:${convenio?.banco === '341' ? '#EC7000' : '#003087'};font-size:11pt">${bancoLogo}</div>
    <div class="banco-codigo" style="font-size:9pt">${bancoCod}</div>
    <div class="banco-linha-digitavel" style="font-size:8pt">${payload.linhaDigitavelFormatada}</div>
  </div>

  <div style="border:1px solid #000">
    <div class="grid-row" style="border:none;border-bottom:1px solid #000">
      ${campo('Beneficiário', convenio?.cedente || '—', true)}
      ${campo('Vencimento', vencFormatado, true, false, 'w-venc')}
    </div>
    <div class="grid-row" style="border:none;border-bottom:1px solid #000;min-height:34pt">
      ${campo('Sacado / Descrição', `<strong>${pagador.nome}</strong><br><span style="font-size:7pt;color:#444">${descricao}${payload.payload.numeroDocumento ? ' · Doc: ' + payload.payload.numeroDocumento : ''}</span>`)}
      ${campo('Valor do Documento', 'R$ ' + fmtMoeda(valor), true, true, 'w-valor')}
    </div>
    <div class="autenticacao" style="border:none;border-top:1px solid #000">
      <span>Autenticação Mecânica</span>
      <span>Nosso Número: ${payload.nossoNumeroFormatado} &nbsp;|&nbsp; Carteira: ${convenio?.carteira || '109'} &nbsp;|&nbsp; Ag: ${convenio?.agencia || '—'}-${convenio?.digitoAgencia || '0'}</span>
    </div>
  </div>

</div>

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 700);
  };
</script>
</body>
</html>`

  return html
}
