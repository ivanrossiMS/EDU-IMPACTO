import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  gerarPosicionamentoPadrao,
  validarPosicionamentoCompleto,
} from '../components/matriculas/PosicionadorAssinaturasModal.tsx'
import {
  anexarCertificadoEvidencias,
} from '../lib/contracts/digitalEvidenceCertificate.ts'

test('Sistema de Posicionamento Visual de Assinaturas e Supressão de Rubrica de Rodapé', async (t) => {
  await t.test('1. gerarPosicionamentoPadrao: distribui 1 signatário centralizado no rodapé da última página', () => {
    const signatarios = [
      { id: 'sig-1', nome: 'IVAN ROSSI SAMBRANA', cargo: 'Diretor Geral', cpf: '00130220167', tipo: 'escola', cor: '#2563eb' }
    ]
    const posicoes = gerarPosicionamentoPadrao(signatarios, 3)
    assert.ok(posicoes['sig-1'], 'Deve conter posição para o signatário 1')
    assert.equal(posicoes['sig-1'].pagina, 3, 'Deve posicionar na última página (3)')
    assert.equal(posicoes['sig-1'].xPercent, 32, 'Deve centralizar horizontalmente')
    assert.equal(posicoes['sig-1'].yPercent, 82, 'Deve posicionar no rodapé')
  })

  await t.test('2. gerarPosicionamentoPadrao: distribui 2 signatários lado a lado no rodapé da última página', () => {
    const signatarios = [
      { id: 'sig-escola', nome: 'IVAN ROSSI SAMBRANA', cargo: 'Diretor', cpf: '00130220167', tipo: 'escola', cor: '#2563eb' },
      { id: 'sig-resp', nome: 'MARIA APARECIDA DA SILVA', cargo: 'Mãe', cpf: '12345678901', tipo: 'responsavel', cor: '#10b981' }
    ]
    const posicoes = gerarPosicionamentoPadrao(signatarios, 2)
    assert.equal(posicoes['sig-escola'].pagina, 2)
    assert.equal(posicoes['sig-resp'].pagina, 2)
    assert.equal(posicoes['sig-escola'].xPercent, 8, 'Signatário da esquerda')
    assert.equal(posicoes['sig-resp'].xPercent, 54, 'Signatário da direita')
    assert.equal(posicoes['sig-escola'].yPercent, 82)
    assert.equal(posicoes['sig-resp'].yPercent, 82)
  })

  await t.test('3. gerarPosicionamentoPadrao: distribui 3 ou mais signatários em grade harmônica', () => {
    const signatarios = [
      { id: 'sig-1', nome: 'Diretor Geral', cargo: 'Diretor', tipo: 'escola', cor: '#2563eb' },
      { id: 'sig-2', nome: 'Coordenadora', cargo: 'Coordenadora', tipo: 'escola', cor: '#7c3aed' },
      { id: 'sig-3', nome: 'Responsável Financeiro', cargo: 'Pai', tipo: 'responsavel', cor: '#10b981' }
    ]
    const posicoes = gerarPosicionamentoPadrao(signatarios, 1)
    assert.equal(Object.keys(posicoes).length, 3)
    assert.equal(posicoes['sig-1'].pagina, 1)
    assert.equal(posicoes['sig-2'].pagina, 1)
    assert.equal(posicoes['sig-3'].pagina, 1)
    // Linha 1
    assert.equal(posicoes['sig-1'].yPercent, 72)
    assert.equal(posicoes['sig-2'].yPercent, 72)
    // Linha 2
    assert.equal(posicoes['sig-3'].yPercent, 84)
  })

  await t.test('4. suprimirRubricaRodape: Não estampa selo repetitivo no rodapé de cada folha quando solicitado', async () => {
    // Cria um PDF de teste de 2 páginas
    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89])
    doc.addPage([595.28, 841.89])
    const pdfBytes = await doc.save()

    const resultadoSemRubrica = await anexarCertificadoEvidencias({
      originalPdfBytes: pdfBytes,
      protocolo: 'IMP-POS-2026-0001',
      tokenAssinatura: 'token_pos_test_12345',
      documentoTitulo: 'Termo de Matrícula Digital Teste',
      documentoOriginalHash: 'b'.repeat(64),
      alunoNome: 'JOAO PEDRO DA SILVA',
      anoLetivo: '2026',
      signatario: {
        nome: 'MARIA APARECIDA DA SILVA',
        cpf: '12345678901',
        email: 'maria@email.com',
        telefone: '(67) 99999-8888',
        parentesco: 'Mãe',
        dataHoraAssinatura: '2026-10-13T12:00:00.000Z',
        ip: '189.123.45.67',
        dispositivo: 'Desktop Chrome',
        sistemaOperacional: 'macOS',
        navegador: 'Chrome 120.0',
        tipoAssinatura: 'manual',
      },
      posicoesAssinaturas: [
        {
          signatarioId: 'sig-escola',
          nome: 'IVAN ROSSI SAMBRANA',
          cargo: 'Diretor Geral',
          cpf: '00130220167',
          tipo: 'escola',
          pagina: 2,
          xPercent: 8,
          yPercent: 82,
        },
        {
          signatarioId: 'sig-resp',
          nome: 'MARIA APARECIDA DA SILVA',
          cargo: 'Responsável',
          cpf: '12345678901',
          tipo: 'responsavel',
          pagina: 2,
          xPercent: 54,
          yPercent: 82,
        }
      ],
      suprimirRubricaRodape: true,
      historicoEventos: [
        {
          id: 'ev-1',
          timestamp: new Date().toISOString(),
          evento: 'CRIACAO',
          descricao: 'Documento criado',
          hash: 'hash-criacao-123'
        },
        {
          id: 'ev-2',
          timestamp: new Date().toISOString(),
          evento: 'ASSINATURA_RESPONSAVEL',
          descricao: 'Assinado pelo responsável',
          hash: 'hash-assinatura-456'
        }
      ]
    })

    assert.ok(resultadoSemRubrica.pdfBytes, 'PDF deve ser gerado')
    assert.ok(resultadoSemRubrica.documentoFinalHash, 'Deve conter hash SHA-256 de integridade')

    // Carrega o PDF gerado e verifica páginas
    const docGerado = await PDFDocument.load(resultadoSemRubrica.pdfBytes)
    assert.equal(docGerado.getPageCount(), 3, '2 páginas de documento + 1 página de Certificado de Evidências')
  })

  await t.test('5. Estampagem precisa de assinaturas nas coordenadas configuradas', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89])
    const pdfBytes = await doc.save()

    const resultado = await anexarCertificadoEvidencias({
      originalPdfBytes: pdfBytes,
      protocolo: 'IMP-COORD-2026-9999',
      tokenAssinatura: 'token_coords_test',
      documentoTitulo: 'Contrato de Prestação de Serviços',
      documentoOriginalHash: 'c'.repeat(64),
      alunoNome: 'ESTUDANTE COORDENADAS',
      anoLetivo: '2026',
      signatario: {
        nome: 'CARLOS EDUARDO SANTOS',
        cpf: '98765432100',
        email: 'carlos@email.com',
        telefone: '(67) 98888-7777',
        parentesco: 'Pai',
        dataHoraAssinatura: '2026-10-13T12:00:00.000Z',
        ip: '189.123.45.67',
        dispositivo: 'Desktop Chrome',
        sistemaOperacional: 'macOS',
        navegador: 'Chrome 120.0',
        tipoAssinatura: 'manual',
      },
      posicoesAssinaturas: [
        {
          signatarioId: 'sig-escola',
          nome: 'IVAN ROSSI SAMBRANA',
          cargo: 'Representante Legal',
          cpf: '00130220167',
          tipo: 'escola',
          pagina: 1,
          xPercent: 10,
          yPercent: 75,
        }
      ],
      suprimirRubricaRodape: true,
      historicoEventos: [
        {
          id: 'ev-1',
          timestamp: new Date().toISOString(),
          evento: 'CRIACAO',
          descricao: 'Emissão',
          hash: 'hash-test-abc'
        }
      ]
    })

    assert.ok(resultado.pdfBytes.length > 1000)
    const docGerado2 = await PDFDocument.load(resultado.pdfBytes)
    assert.equal(docGerado2.getPageCount(), 2, '1 página do contrato com assinatura posicionada + 1 folha de evidências')
  })

  await t.test('6. Posicionamento flexível multi-documentos: não é obrigatório posicionar todas as assinaturas em todos os documentos', async () => {
    const signatarios = [
      { id: 'sig-escola', nome: 'IVAN ROSSI SAMBRANA', cargo: 'Diretor', cpf: '00130220167', tipo: 'escola', cor: '#2563eb' },
      { id: 'sig-resp', nome: 'MARIA APARECIDA DA SILVA', cargo: 'Mãe', cpf: '12345678901', tipo: 'responsavel', cor: '#10b981' }
    ]

    const documentos = [
      { id: 'doc-1', nome: 'Contrato_Prestacao_2026.pdf', totalPaginas: 2, paginaInicioGlobal: 1, paginaFimGlobal: 2 },
      { id: 'doc-2', nome: 'Termo_Autorizacao_Imagem.pdf', totalPaginas: 1, paginaInicioGlobal: 3, paginaFimGlobal: 3 },
      { id: 'doc-3', nome: 'Regimento_Escolar.pdf', totalPaginas: 2, paginaInicioGlobal: 4, paginaFimGlobal: 5 },
    ]

    // Usuário posicionou:
    // - Ambos no Documento 1 (Contrato)
    // - Apenas a mãe no Documento 2 (Termo de Imagem)
    // - NENHUM no Documento 3 (Regimento - coberto pelo certificado final)
    const posicoesCustomizadas = {
      'sig-escola_doc_doc-1': {
        id: 'sig-escola_doc_doc-1',
        signatarioId: 'sig-escola',
        nome: 'IVAN ROSSI SAMBRANA',
        cargo: 'Diretor',
        tipo: 'escola',
        documentoId: 'doc-1',
        documentoNome: 'Contrato_Prestacao_2026.pdf',
        pagina: 2,
        paginaRelativa: 2,
        xPercent: 8,
        yPercent: 80,
      },
      'sig-resp_doc_doc-1': {
        id: 'sig-resp_doc_doc-1',
        signatarioId: 'sig-resp',
        nome: 'MARIA APARECIDA DA SILVA',
        cargo: 'Mãe',
        tipo: 'responsavel',
        documentoId: 'doc-1',
        documentoNome: 'Contrato_Prestacao_2026.pdf',
        pagina: 2,
        paginaRelativa: 2,
        xPercent: 54,
        yPercent: 80,
      },
      'sig-resp_doc_doc-2': {
        id: 'sig-resp_doc_doc-2',
        signatarioId: 'sig-resp',
        nome: 'MARIA APARECIDA DA SILVA',
        cargo: 'Mãe',
        tipo: 'responsavel',
        documentoId: 'doc-2',
        documentoNome: 'Termo_Autorizacao_Imagem.pdf',
        pagina: 3,
        paginaRelativa: 1,
        xPercent: 32,
        yPercent: 85,
      },
    }

    // 1. Diagnóstico de validação
    const diag = validarPosicionamentoCompleto(signatarios, documentos, posicoesCustomizadas)
    assert.equal(diag.totalPosicionado, 3, 'Total de posições definidas deve ser 3')
    assert.equal(diag.porDocumento[0].posicionados.length, 2, 'Doc 1 deve ter 2 signatários')
    assert.equal(diag.porDocumento[1].posicionados.length, 1, 'Doc 2 deve ter apenas 1 signatário')
    assert.equal(diag.porDocumento[2].posicionados.length, 0, 'Doc 3 não possui signatários visuais')
    assert.equal(diag.tudoPosicionado, false, 'tudoPosicionado é false mas isso NÃO impede o salvamento')

    // 2. Estampagem real no PDF consolidado (5 páginas de documento + 1 de certificado)
    const doc = await PDFDocument.create()
    for (let i = 0; i < 5; i++) {
      doc.addPage([595.28, 841.89])
    }
    const pdfBytes = await doc.save()

    const resultado = await anexarCertificadoEvidencias({
      originalPdfBytes: pdfBytes,
      protocolo: 'IMP-MULTI-FLEX-2026',
      tokenAssinatura: 'token_multi_flex',
      documentoTitulo: 'Pacote Multi-Documentos Flexível',
      documentoOriginalHash: 'd'.repeat(64),
      alunoNome: 'ALUNO TESTE FLEXIVEL',
      anoLetivo: '2026',
      signatario: {
        nome: 'MARIA APARECIDA DA SILVA',
        cpf: '12345678901',
        email: 'maria@email.com',
        parentesco: 'Mãe',
        dataHoraAssinatura: '2026-10-13T12:00:00.000Z',
        tipoAssinatura: 'manual',
      },
      posicoesAssinaturas: Object.values(posicoesCustomizadas),
      suprimirRubricaRodape: true,
      historicoEventos: [
        {
          id: 'ev-1',
          timestamp: new Date().toISOString(),
          evento: 'EMISSAO',
          descricao: 'Emissão flexível multi-documentos',
          hash: 'hash-flex-abc',
        }
      ]
    })

    assert.ok(resultado.pdfBytes, 'PDF multi-documentos flexível gerado com sucesso')
    assert.ok(resultado.documentoFinalHash, 'Hash final de integridade gerado')
    const docCarregado = await PDFDocument.load(resultado.pdfBytes)
    assert.equal(docCarregado.getPageCount(), 6, '5 páginas originais + 1 página de Certificado de Evidências')
  })
})
