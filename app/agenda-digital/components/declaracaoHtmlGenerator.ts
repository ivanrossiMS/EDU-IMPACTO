import { DeclaracaoIrpfData } from './DeclaracaoIrpfDocument'

export function generateDeclaracaoHtml(data: DeclaracaoIrpfData): string {
  const {
    escola,
    responsavel,
    aluno,
    anoCalendario,
    exercicio,
    mensalidades,
    quantidadeMensalidades,
    totalPagoFormatado,
    totalPagoPorExtenso,
    codigoAutenticidade,
    cidadeDataEmissao,
  } = data

  const rowsHtml =
    quantidadeMensalidades > 0
      ? mensalidades
          .map(
            (m, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #64748b;">${m.index}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${m.competencia}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #334155;">${m.descricao}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-family: monospace;">${m.vencimento}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #059669; font-family: monospace;">${m.dataPagamento}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 800; color: #0f172a; font-family: monospace;">${m.valorPago}</td>
        </tr>
      `
          )
          .join('')
      : `
        <tr>
          <td colspan="6" style="padding: 14px; text-align: center; color: #64748b; font-size: 11px; border: 1px solid #cbd5e1;">
            Não constam registros de mensalidades escolares pagas para este aluno no ano-calendário de ${anoCalendario}.
          </td>
        </tr>
      `

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Declaração IRPF ${anoCalendario} - ${aluno.nome}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      padding: 20px 0;
      margin: 0;
      font-size: 11px;
      line-height: 1.35;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #0f172a;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      margin-bottom: 20px;
    }
    .print-toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }
    .btn-print-action {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-print-action:hover {
      background: #4338ca;
    }
    .btn-close-action {
      background: #334155;
      color: #f8fafc;
    }
    .btn-close-action:hover {
      background: #475569;
    }
    .page-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 10mm 12mm;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      border-radius: 8px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
    }
    .logo-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      height: 44px;
      width: auto;
      display: block;
    }
    .v-divider {
      width: 1.5px;
      height: 38px;
      background: #e2e8f0;
    }
    .slogan-title {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
    }
    .slogan-sub {
      font-size: 12px;
      font-weight: 900;
      color: #4f46e5;
      line-height: 1.2;
    }
    .slogan-seg {
      font-size: 8px;
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
    }
    .header-fiscal {
      text-align: right;
    }
    .fiscal-badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      color: #4f46e5;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .school-name {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .school-cnpj {
      font-size: 9px;
      color: #334155;
      font-weight: 700;
      margin-top: 1px;
    }
    .school-addr {
      font-size: 8px;
      color: #64748b;
      margin-top: 1px;
    }
    .grad-divider {
      height: 2px;
      background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%);
      margin: 4px 0 8px 0;
      border-radius: 2px;
    }
    .doc-title-h1 {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 0 0 4px 0;
    }
    .year-pill-wrap {
      display: flex;
      justify-content: center;
      margin-bottom: 3px;
    }
    .year-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 8.5px;
      font-weight: 700;
      color: #475569;
    }
    .law-subtitle {
      font-size: 7.5px;
      color: #94a3b8;
      text-align: center;
      margin-bottom: 6px;
    }
    .deck-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .deck-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 5px 8px;
      background: #f8fafc;
      font-size: 9px;
    }
    .deck-card-title {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #4f46e5;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .deck-card-main {
      font-weight: 800;
      color: #0f172a;
    }
    .student-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 8px;
      background: #ffffff;
      font-size: 9px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
    }
    .legal-text {
      font-size: 9px;
      line-height: 1.35;
      color: #1e293b;
      text-align: justify;
      margin: 0 0 5px 0;
    }
    .irpf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 4px;
    }
    .irpf-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 0.3px;
      padding: 4px 6px;
      border: 1px solid #0f172a;
    }
    .irpf-table td {
      border: 1px solid #cbd5e1;
    }
    .extenso-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 8px;
      margin-bottom: 3px;
      color: #334155;
    }
    .disclaimer-note {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      font-style: italic;
      margin: 2px 0 4px 0;
      text-align: left;
    }
    .closing-text {
      font-size: 8px;
      line-height: 1.25;
      color: #1e293b;
      margin: 0 0 4px 0;
      text-align: justify;
    }
    .city-date {
      text-align: right;
      font-size: 8.5px;
      color: #334155;
      margin-bottom: 4px;
      font-weight: 700;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 4px;
    }
    .auth-box {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 8.5px;
      color: #475569;
      background: #f8fafc;
      width: 48%;
    }
    .auth-title {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      color: #4f46e5;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }
    .sig-box {
      text-align: center;
      width: 48%;
    }
    .sig-line {
      border-top: 1px solid #0f172a;
      padding-top: 2px;
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer-bar {
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
      margin-top: 6px;
      text-align: center;
      font-size: 7.5px;
      color: #64748b;
      line-height: 1.25;
    }

    @media print {
      .print-toolbar {
        display: none !important;
      }
      body {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
      }
      .page-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        display: block !important;
      }
      .signatures-row, .header-row, .deck-grid, .student-card {
        display: flex !important;
      }
      .deck-grid {
        display: grid !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button class="btn-print-action" onclick="window.print()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      <span>Imprimir / Salvar PDF</span>
    </button>
    <button class="btn-close-action" onclick="window.close()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      <span>Fechar</span>
    </button>
  </div>
  <div class="page-container">
    <div>
      <!-- 1. CABEÇALHO -->
      <div class="header-row">
        <div class="logo-group">
          <img src="/logo-impacto.png" alt="Colégio Impacto" class="logo-img" />
          <div class="v-divider"></div>
          <div>
            <div class="slogan-title">Formando valores.</div>
            <div class="slogan-sub">Inspirando futuros.</div>
            <div class="slogan-seg">Educação Infantil • Ensino Fundamental • Ensino Médio</div>
          </div>
        </div>
        <div class="header-fiscal">
          <div class="fiscal-badge">Documento Fiscal Oficial</div>
          <div class="school-name">${escola.razaoSocial}</div>
          <div class="school-cnpj">CNPJ: <span style="font-family: monospace;">${escola.cnpj}</span></div>
          <div class="school-addr">${escola.endereco} • ${escola.cidadeUf}</div>
        </div>
      </div>

      <div class="grad-divider"></div>

      <!-- 2. TÍTULO -->
      <h1 class="doc-title-h1">DECLARAÇÃO DE PAGAMENTOS EFETUADOS PARA IRPF</h1>
      <div class="year-pill-wrap">
        <div class="year-pill">
          <span>Ano-Calendário: <strong style="color: #0f172a;">${anoCalendario}</strong></span>
          <span>•</span>
          <span>Exercício Fiscal: <strong style="color: #0f172a;">${exercicio}</strong></span>
        </div>
      </div>
      <div class="law-subtitle">(Em cumprimento à Lei Federal nº 12.007/2009 e normativas da Receita Federal do Brasil)</div>

      <!-- 3. DECK IDENTIFICAÇÃO -->
      <div class="deck-grid">
        <div class="deck-card">
          <div class="deck-card-title">1. Instituição de Ensino / Credora</div>
          <div class="deck-card-main">${escola.razaoSocial}</div>
          <div style="color: #334155; margin-top: 1px;"><strong>CNPJ:</strong> <span style="font-family: monospace;">${escola.cnpj}</span></div>
          <div style="color: #64748b; font-size: 8px; margin-top: 1px;">${escola.endereco} • ${escola.cidadeUf}</div>
        </div>

        <div class="deck-card">
          <div class="deck-card-title">2. Contribuinte / Responsável Financeiro</div>
          <div class="deck-card-main">${responsavel.nome}</div>
          <div style="color: #334155; margin-top: 1px;"><strong>CPF:</strong> <span style="font-family: monospace;">${responsavel.cpf}</span></div>
          <div style="color: #64748b; font-size: 8px; margin-top: 1px;">Beneficiário(a): ${aluno.nome}</div>
        </div>
      </div>

      <div class="student-card">
        <div><strong style="color: #4f46e5;">ALUNO(A):</strong> <span style="font-weight: 800; color: #0f172a;">${aluno.nome}</span></div>
        <div><strong style="color: #475569;">MATRÍCULA:</strong> <span style="font-family: monospace; font-weight: 700;">${aluno.matricula}</span></div>
        <div><strong style="color: #475569;">TURMA / SÉRIE:</strong> <span style="font-weight: 800; color: #0f172a;">${aluno.turma}</span></div>
        <div><strong style="color: #475569;">SEGMENTO:</strong> <span style="font-weight: 700;">${escola.segmento}</span></div>
      </div>

      <!-- 4. TEXTO DECLARATÓRIO -->
      <p class="legal-text">
        Declaramos, para os devidos fins de comprovação de despesas com instrução junto à <strong>Secretaria Especial da Receita Federal do Brasil (Declaração de Ajuste Anual de IRPF)</strong> e em cumprimento aos termos da <strong>Lei Federal nº 12.007, de 29 de julho de 2009</strong>, que o(a) responsável financeiro acima qualificado(a) efetuou a quitação das mensalidades escolares relacionadas abaixo dos serviços educacionais prestados ao(à) aluno(a) durante o ano-calendário de <strong>${anoCalendario}</strong>, conforme discriminado a seguir:
      </p>

      <!-- 5. TABELA DE MENSALIDADES -->
      <table class="irpf-table">
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">#</th>
            <th style="width: 18%;">Competência</th>
            <th style="width: 37%;">Descrição do Serviço</th>
            <th style="width: 13%; text-align: center;">Vencimento</th>
            <th style="width: 13%; text-align: center;">Data Pagto</th>
            <th style="width: 14%; text-align: right;">Valor Pago</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        ${
          quantidadeMensalidades > 0
            ? `<tfoot>
          <tr style="background: #f1f5f9;">
            <td colspan="5" style="text-align: right; padding: 5px 6px; font-weight: 900; color: #0f172a; font-size: 9px; border: 1px solid #0f172a; border-top: 2px solid #0f172a;">
              Total de mensalidades pagas em ${anoCalendario}:
            </td>
            <td style="text-align: right; padding: 5px 6px; font-weight: 900; color: #4f46e5; font-size: 10.5px; border: 1px solid #0f172a; border-top: 2px solid #0f172a; font-family: monospace;">
              ${totalPagoFormatado}
            </td>
          </tr>
        </tfoot>`
            : ''
        }
      </table>

      <!-- 6. VALOR POR EXTENSO & INDICAÇÃO LEGAL -->
      ${
        quantidadeMensalidades > 0
          ? `<div class="extenso-box">
        <strong>Valor Total por Extenso:</strong> ${totalPagoPorExtenso}.
      </div>`
          : ''
      }

      <div class="disclaimer-note">
        * Este documento não representa quitação integral do contrato.
      </div>

      <!-- 7. FECHAMENTO & DATA -->
      <p class="closing-text">
        Por ser a expressão da verdade e para que produza seus regulares efeitos legais e fiscais, firmamos a presente declaração.
      </p>

      <div class="city-date">${cidadeDataEmissao}</div>

      <!-- 8. ASSINATURA & AUTENTICIDADE -->
      <div class="signatures-row">
        <div class="auth-box">
          <div class="auth-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Autenticidade e Controle Fiscal</span>
          </div>
          <div>Código: <strong style="font-family: monospace; color: #0f172a;">${codigoAutenticidade}</strong></div>
          <div style="font-size: 7.5px; color: #94a3b8; margin-top: 1px;">Emitido eletronicamente via Sistema Impacto EDU.</div>
        </div>

        <div class="sig-box">
          <!-- Assinatura Manual de Ivan Rossi -->
          <div style="margin-bottom: -6px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 260 70" fill="none" xmlns="http://www.w3.org/2000/svg" style="height: 40px; width: auto; transform: rotate(-2deg);">
              <path d="M20 45 C28 20, 38 8, 42 28 C45 42, 38 52, 32 40 C28 28, 38 18, 54 34 L62 44" stroke="#1d4ed8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="30" cy="14" r="1.6" fill="#1d4ed8" />
              <path d="M62 40 L68 30 L74 42 L80 32 C84 30, 88 30, 92 36 L92 44 C95 34, 102 30, 108 42 L114 42" stroke="#1d4ed8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M126 48 C124 30, 128 12, 136 10 C146 8, 160 12, 154 26 C150 36, 138 36, 130 36 C138 36, 150 40, 158 48" stroke="#1d4ed8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M160 38 C164 32, 172 32, 170 40 C168 46, 160 46, 164 38 C168 32, 178 34, 182 42 C186 34, 192 34, 194 42 C196 32, 202 34, 206 42" stroke="#1d4ed8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="206" cy="24" r="1.5" fill="#1d4ed8" />
              <path d="M115 52 C145 46, 195 45, 235 48" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </div>
          <div class="sig-line">Ivan Rossi</div>
          <div style="font-size: 8px; color: #475569; font-weight: 700;">Direção Geral e Controladoria</div>
          <div style="font-size: 7.5px; color: #64748b;">${escola.razaoSocial}</div>
          <div style="font-size: 7px; color: #94a3b8;">CNPJ: ${escola.cnpj}</div>
        </div>
      </div>
    </div>

    <!-- 9. RODAPÉ -->
    <div class="footer-bar">
      <div style="font-weight: 700; color: #334155;">${escola.nomeFantasia} — ${escola.segmento}</div>
      <div>Rua Alagoas, 1081 - Jardim dos Estados, Campo Grande/MS • Tel: (67) 3025-5585 • impacto@colegioimpacto.net • www.colegioimpacto.net</div>
    </div>
  </div>
  <script>
    function triggerPrint() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }, 350);
    }
    if (document.readyState === 'complete') {
      triggerPrint();
    } else {
      window.addEventListener('load', triggerPrint);
    }
  </script>
</body>
</html>`
}
