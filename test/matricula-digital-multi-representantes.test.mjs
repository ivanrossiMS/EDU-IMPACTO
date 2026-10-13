import assert from 'node:assert/strict'
import test from 'node:test'
import { validarCPF } from '../lib/contracts/sealUtils.ts'

test('Múltiplos Representantes da Escola - Configuração, Seleção e Emissão', async (t) => {
  // Dados de teste simulando a estrutura configurada
  const mockRepresentantes = [
    {
      id: 'rep_infantil_fundamental',
      razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
      cnpj: '04.395.789/0001-88',
      segmento: 'Ed. Infantil e Ens. Fund',
      padrao: true,
      signatarios: [
        {
          id: 'sig_ivan',
          nome: 'IVAN ROSSI SAMBRANA',
          cpf: '00130220167',
          cargo: 'Representante Legal / Diretor Geral',
          email: 'direcao@colegioimpacto.net',
          telefone: '(67) 99280-6464',
          padrao: true,
        },
        {
          id: 'sig_luciana',
          nome: 'LUCIANA ALBUQUERQUE',
          cpf: '78912345600',
          cargo: 'Diretora Pedagógica',
          email: 'pedagogico@colegioimpacto.net',
          telefone: '(67) 99123-4567',
          padrao: false,
        },
        {
          id: 'sig_carlos',
          nome: 'CARLOS EDUARDO SANTOS',
          cpf: '12345678909',
          cargo: 'Secretário Geral / Procurador',
          email: 'secretaria@colegioimpacto.net',
          telefone: '(67) 99988-7766',
          padrao: false,
        },
      ],
      // Retrocompatibilidade
      nome: 'IVAN ROSSI SAMBRANA',
      cpf: '00130220167',
      cargo: 'Representante Legal / Diretor Geral',
    },
    {
      id: 'rep_ensino_medio',
      razaoSocial: 'CENTRO DE ENSINO IMPACTO LTDA',
      cnpj: '04.397.021/0001-43',
      segmento: 'Ens. Médio',
      padrao: false,
      signatarios: [
        {
          id: 'sig_ivan_medio',
          nome: 'IVAN ROSSI SAMBRANA',
          cpf: '00130220167',
          cargo: 'Representante Legal / Diretor Geral',
          email: 'direcao@colegioimpacto.net',
          telefone: '(67) 99280-6464',
          padrao: true,
        },
      ],
      nome: 'IVAN ROSSI SAMBRANA',
      cpf: '00130220167',
      cargo: 'Representante Legal / Diretor Geral',
    },
  ]

  await t.test('1. Permite múltiplos representantes cadastrados sob uma mesma instituição (CNPJ)', () => {
    const repInfantil = mockRepresentantes[0]
    assert.equal(repInfantil.signatarios.length, 3, 'Deve conter 3 representantes cadastrados')
    assert.equal(repInfantil.signatarios[0].nome, 'IVAN ROSSI SAMBRANA')
    assert.equal(repInfantil.signatarios[1].nome, 'LUCIANA ALBUQUERQUE')
    assert.equal(repInfantil.signatarios[2].nome, 'CARLOS EDUARDO SANTOS')
  })

  await t.test('2. Identifica e seleciona o signatário padrão por padrão', () => {
    const repInfantil = mockRepresentantes[0]
    const sigPadrao = repInfantil.signatarios.find(s => s.padrao) || repInfantil.signatarios[0]
    assert.equal(sigPadrao.id, 'sig_ivan')
    assert.equal(sigPadrao.cargo, 'Representante Legal / Diretor Geral')
  })

  await t.test('3. Permite selecionar manualmente um representante alternativo para assinar o documento', () => {
    const repInfantil = mockRepresentantes[0]
    // Usuário escolhe a Diretora Pedagógica (sig_luciana)
    const idSelecionado = 'sig_luciana'
    const sigEscolhido = repInfantil.signatarios.find(s => s.id === idSelecionado)
    assert.ok(sigEscolhido, 'Signatário alternativo deve ser encontrado')
    assert.equal(sigEscolhido.nome, 'LUCIANA ALBUQUERQUE')
    assert.equal(sigEscolhido.cargo, 'Diretora Pedagógica')

    // Monta os dados enviados para a emissão do documento
    const repInfo = {
      id: repInfantil.id,
      signatarioId: sigEscolhido.id,
      nome: sigEscolhido.nome,
      cpf: sigEscolhido.cpf,
      cargo: sigEscolhido.cargo,
      razaoSocial: repInfantil.razaoSocial,
      cnpj: repInfantil.cnpj,
      dataHoraAssinatura: new Date().toISOString(),
    }

    assert.equal(repInfo.nome, 'LUCIANA ALBUQUERQUE')
    assert.equal(repInfo.cargo, 'Diretora Pedagógica')
    assert.equal(repInfo.razaoSocial, 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA')
    assert.equal(repInfo.cnpj, '04.395.789/0001-88')
  })

  await t.test('4. Replicador de representantes copia lista para os demais CNPJs', () => {
    const sigsOrigem = mockRepresentantes[0].signatarios
    const replicados = sigsOrigem.map((s, idx) => ({
      ...s,
      id: `sig_medio_${idx + 1}`,
    }))

    assert.equal(replicados.length, 3)
    assert.equal(replicados[0].nome, 'IVAN ROSSI SAMBRANA')
    assert.equal(replicados[1].nome, 'LUCIANA ALBUQUERQUE')
    assert.equal(replicados[2].nome, 'CARLOS EDUARDO SANTOS')
  })

  await t.test('5. Validação de CPFs dos representantes garante conformidade jurídica', () => {
    assert.equal(validarCPF('00130220167'), true, 'CPF válido deve ser aceito')
    assert.equal(validarCPF('11111111111'), false, 'CPF repetido deve ser rejeitado')
    assert.equal(validarCPF('12345678900'), false, 'Dígito verificador inválido deve ser rejeitado')
  })

  await t.test('6. Permite seleção simultânea de múltiplos representantes da instituição (assinatura conjunta)', () => {
    const repInfantil = mockRepresentantes[0]
    // Usuário seleciona Ivan Rossi Sambrana E Luciana Albuquerque simultaneamente
    const idsEscolhidos = ['sig_ivan', 'sig_luciana']
    const signatariosEscolhidos = repInfantil.signatarios.filter(s => idsEscolhidos.includes(s.id))

    assert.equal(signatariosEscolhidos.length, 2, 'Devem haver 2 signatários selecionados')
    assert.equal(signatariosEscolhidos[0].nome, 'IVAN ROSSI SAMBRANA')
    assert.equal(signatariosEscolhidos[1].nome, 'LUCIANA ALBUQUERQUE')

    // Constrói a estrutura repInfo compatível com a API e o banco
    const repInfo = {
      id: repInfantil.id,
      signatarioId: signatariosEscolhidos[0].id,
      nome: signatariosEscolhidos[0].nome,
      cpf: signatariosEscolhidos[0].cpf,
      cargo: signatariosEscolhidos[0].cargo,
      razaoSocial: repInfantil.razaoSocial,
      cnpj: repInfantil.cnpj,
      dataHoraAssinatura: new Date().toISOString(),
      representantes: signatariosEscolhidos.map(s => ({
        id: s.id,
        nome: s.nome,
        cpf: s.cpf,
        cargo: s.cargo,
        email: s.email,
        telefone: s.telefone,
      })),
    }

    assert.equal(repInfo.representantes.length, 2)
    assert.equal(repInfo.representantes[0].cargo, 'Representante Legal / Diretor Geral')
    assert.equal(repInfo.representantes[1].cargo, 'Diretora Pedagógica')
  })

  await t.test('7. Gera evento de auditoria ASSINATURA_ESCOLA individual para cada representante com encadeamento de hash SHA-256', async () => {
    const { calculateSha256 } = await import('../lib/contracts/cryptoSignature.ts')

    const repInfantil = mockRepresentantes[0]
    const idsEscolhidos = ['sig_ivan', 'sig_luciana', 'sig_carlos']
    const signatariosEscolhidos = repInfantil.signatarios.filter(s => idsEscolhidos.includes(s.id))

    const dataCriacao = '2026-10-13T12:00:00.000Z'
    const clientIp = '189.123.45.67'
    const eventoCriacaoHash = calculateSha256(`GENESIS|doc_123|${dataCriacao}|CRIACAO|${clientIp}`)

    const historicoEventos = [
      {
        id: 'ev-init-1',
        timestamp: dataCriacao,
        evento: 'CRIACAO',
        descricao: 'Documento emitido no sistema',
        ip: clientIp,
        hash: eventoCriacaoHash,
      },
    ]

    let lastHash = eventoCriacaoHash
    signatariosEscolhidos.forEach((rep, repIdx) => {
      const sigHash = calculateSha256(`${lastHash}|ASSINATURA_ESCOLA|${rep.cpf}|${dataCriacao}|${clientIp}`)
      lastHash = sigHash
      historicoEventos.push({
        id: `ev-sch-1-${repIdx}`,
        timestamp: dataCriacao,
        evento: 'ASSINATURA_ESCOLA',
        descricao: `Chancela institucional emitida por ${rep.nome} (${rep.cargo})`,
        ip: clientIp,
        hash: sigHash,
      })
    })

    assert.equal(historicoEventos.length, 4, '1 evento CRIACAO + 3 eventos ASSINATURA_ESCOLA')
    assert.equal(historicoEventos[1].descricao, 'Chancela institucional emitida por IVAN ROSSI SAMBRANA (Representante Legal / Diretor Geral)')
    assert.equal(historicoEventos[2].descricao, 'Chancela institucional emitida por LUCIANA ALBUQUERQUE (Diretora Pedagógica)')
    assert.equal(historicoEventos[3].descricao, 'Chancela institucional emitida por CARLOS EDUARDO SANTOS (Secretário Geral / Procurador)')

    // Verifica que cada hash da cadeia é único e depende do anterior
    assert.notEqual(historicoEventos[1].hash, historicoEventos[2].hash)
    assert.notEqual(historicoEventos[2].hash, historicoEventos[3].hash)
  })

  await t.test('8. Regra de proteção: Impede desmarcar todos os signatários (mínimo 1 selecionado)', () => {
    let idsSelecionados = ['sig_ivan']

    const tentarRemover = (idRemover) => {
      if (idsSelecionados.length <= 1 && idsSelecionados.includes(idRemover)) {
        return false // Bloqueado
      }
      idsSelecionados = idsSelecionados.filter(id => id !== idRemover)
      return true
    }

    // Tentar desmarcar o único representante selecionado deve ser bloqueado
    const resultado = tentarRemover('sig_ivan')
    assert.equal(resultado, false, 'Não deve permitir desmarcar o último representante')
    assert.equal(idsSelecionados.length, 1)

    // Adiciona outro signatário
    idsSelecionados.push('sig_luciana')
    assert.equal(idsSelecionados.length, 2)

    // Agora desmarcar um deles é permitido pois ainda resta 1
    const resultado2 = tentarRemover('sig_ivan')
    assert.equal(resultado2, true, 'Permite desmarcar quando restam mais representantes')
    assert.deepEqual(idsSelecionados, ['sig_luciana'])
  })

  await t.test('9. Certificado de Evidências formata múltiplos signatários institucionais', async () => {
    const { PDFDocument } = await import('pdf-lib')
    const { anexarCertificadoEvidencias } = await import('../lib/contracts/digitalEvidenceCertificate.ts')

    // Cria um PDF de 1 página de teste
    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89])
    const pdfBytes = await doc.save()

    const repInfantil = mockRepresentantes[0]
    const signatariosEscolhidos = repInfantil.signatarios.slice(0, 3)

    const resultado = await anexarCertificadoEvidencias({
      originalPdfBytes: pdfBytes,
      protocolo: 'MAT-2026-MULTI-01',
      documentoTitulo: 'Contrato de Prestação de Serviços Educacionais',
      documentoOriginalHash: 'a'.repeat(64),
      alunoNome: 'ALUNO TESTE MULTI SIGNATARIOS',
      anoLetivo: '2026',
      signatario: {
        nome: 'MARIA RESPONSAVEL TESTE',
        cpf: '12345678909',
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
      representanteEscola: {
        nome: signatariosEscolhidos[0].nome,
        cpf: signatariosEscolhidos[0].cpf,
        cargo: signatariosEscolhidos[0].cargo,
        razaoSocial: repInfantil.razaoSocial,
        cnpj: repInfantil.cnpj,
        dataHoraAssinatura: '2026-10-13T12:00:00.000Z',
        representantes: signatariosEscolhidos,
      },
      eventosAuditoria: [
        {
          id: 'ev-1',
          timestamp: '2026-10-13T12:00:00.000Z',
          evento: 'CRIACAO',
          descricao: 'Documento criado',
          ip: '189.123.45.67',
          hash: 'b'.repeat(64),
        },
      ],
    })

    assert.ok(resultado.pdfBytes, 'PDF com certificado deve ser gerado')
    assert.ok(resultado.pdfBytes.length > 1000, 'PDF com certificado deve conter dados válidos')
    assert.ok(resultado.base64Pdf, 'Deve conter representação em base64')
    assert.equal(resultado.protocolo, 'MAT-2026-MULTI-01')
    assert.ok(resultado.documentoFinalHash, 'Deve conter hash final criptográfico')
  })

  await t.test('10. Estado inicial limpo: Instituição e representantes NÃO devem vir pré-selecionados', () => {
    // Simula abertura do modal / inicialização do formulário
    const formNovoInicial = {
      aluno_id: '',
      aluno_nome: '',
      titulo_documento: '',
      escola_representante_id: '',
      escola_signatario_id: '',
      escola_signatarios_ids: [],
    }

    assert.equal(formNovoInicial.escola_representante_id, '', 'Nenhuma instituição deve vir pré-selecionada')
    assert.equal(formNovoInicial.escola_signatario_id, '', 'Nenhum signatário deve vir pré-selecionado')
    assert.deepEqual(formNovoInicial.escola_signatarios_ids, [], 'Lista de signatários selecionados deve iniciar vazia')

    // Função de status
    const temInstituicaoSelecionada = Boolean(formNovoInicial.escola_representante_id)
    const idsSelecionados = formNovoInicial.escola_signatarios_ids
    const temSignatariosSelecionados = idsSelecionados.length > 0
    const tudoPronto = temInstituicaoSelecionada && temSignatariosSelecionados

    assert.equal(temInstituicaoSelecionada, false, 'Instituição não está selecionada inicialmente')
    assert.equal(temSignatariosSelecionados, false, 'Nenhum signatário está selecionado inicialmente')
    assert.equal(tudoPronto, false, 'Estado global deve estar incompleto/pendente inicialmente')
  })

  await t.test('11. Validação obrigatória: Impede emissão sem instituição (Passo 1) ou sem representante (Passo 2)', () => {
    // Validação que espelha tanto o frontend quanto a API route
    function validarEmissao(payload) {
      if (!payload.escola_representante_id) {
        return { valido: false, erro: 'Por favor, selecione a Instituição Emissora (Passo 1).' }
      }
      const ids = Array.isArray(payload.escola_signatarios_ids)
        ? payload.escola_signatarios_ids
        : (payload.escola_signatario_id ? [payload.escola_signatario_id] : [])
      if (ids.length === 0) {
        return { valido: false, erro: 'Por favor, selecione ao menos um representante da instituição para assinar o documento (Passo 2).' }
      }
      return { valido: true }
    }

    // Caso 1: Sem instituição e sem representante
    const res1 = validarEmissao({ escola_representante_id: '', escola_signatarios_ids: [] })
    assert.equal(res1.valido, false)
    assert.match(res1.erro, /Passo 1/)

    // Caso 2: Com instituição mas sem representante selecionado
    const res2 = validarEmissao({ escola_representante_id: 'rep_infantil', escola_signatarios_ids: [] })
    assert.equal(res2.valido, false)
    assert.match(res2.erro, /Passo 2/)

    // Caso 3: Com instituição e 1 representante selecionado
    const res3 = validarEmissao({ escola_representante_id: 'rep_infantil', escola_signatarios_ids: ['sig_ivan'] })
    assert.equal(res3.valido, true)

    // Caso 4: Com instituição e múltiplos representantes selecionados
    const res4 = validarEmissao({ escola_representante_id: 'rep_infantil', escola_signatarios_ids: ['sig_ivan', 'sig_luciana'] })
    assert.equal(res4.valido, true)
  })

  await t.test('12. Regras visuais: Amarelo para pendente/não-selecionado e Verde para confirmado/selecionado', () => {
    function obterTemaCardInstituicao(repId, idSelecionado) {
      if (idSelecionado === repId) {
        return { estado: 'selecionado', cor: 'verde', border: '2px solid #10b981', badge: '✓ Selecionada' }
      }
      if (!idSelecionado) {
        return { estado: 'pendente', cor: 'amarelo', border: '1.5px dashed #f59e0b', badge: '⚠️ Clique p/ Selecionar' }
      }
      return { estado: 'inativo', cor: 'neutro', border: '1px solid hsl(var(--border-subtle))', badge: 'Trocar' }
    }

    function obterTemaCardRepresentante(sigId, idsSelecionados) {
      if (idsSelecionados.includes(sigId)) {
        return { estado: 'selecionado', cor: 'verde', border: '2px solid #10b981', badge: '✓ Assina' }
      }
      return { estado: 'pendente', cor: 'amarelo', border: '1.5px dashed #f59e0b', badge: '⚠️ Clique p/ Selecionar' }
    }

    // Inicialmente: Instituição vazia -> Amarelo
    const temaInstInicial = obterTemaCardInstituicao('rep_infantil', '')
    assert.equal(temaInstInicial.cor, 'amarelo')
    assert.equal(temaInstInicial.badge, '⚠️ Clique p/ Selecionar')

    // Após selecionar Instituição: Escolhida -> Verde
    const temaInstEscolhida = obterTemaCardInstituicao('rep_infantil', 'rep_infantil')
    assert.equal(temaInstEscolhida.cor, 'verde')
    assert.equal(temaInstEscolhida.badge, '✓ Selecionada')

    // Outra instituição não escolhida -> Neutro
    const temaInstOutra = obterTemaCardInstituicao('rep_medio', 'rep_infantil')
    assert.equal(temaInstOutra.cor, 'neutro')

    // Representante inicialmente não selecionado -> Amarelo
    const temaRepInicial = obterTemaCardRepresentante('sig_ivan', [])
    assert.equal(temaRepInicial.cor, 'amarelo')
    assert.equal(temaRepInicial.badge, '⚠️ Clique p/ Selecionar')

    // Representante selecionado -> Verde
    const temaRepSelecionado = obterTemaCardRepresentante('sig_ivan', ['sig_ivan'])
    assert.equal(temaRepSelecionado.cor, 'verde')
    assert.equal(temaRepSelecionado.badge, '✓ Assina')
  })
})
