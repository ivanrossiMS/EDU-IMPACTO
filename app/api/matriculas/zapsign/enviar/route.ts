import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { gerarContratoPdf } from '@/lib/contracts/contractPdfGenerator'
import { ContractDataModel } from '@/lib/contracts/contractTemplates'
import { criarDocumentoZapSign, formatPhoneForZapSign } from '@/lib/zapsign'
import { PDFDocument } from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

const CONFIG_CHAVE = 'cfgZapSignInteg'
const FALLBACK_KEY = 'matriculas_contratos_list'

function cleanPdfBase64(raw: string): string {
  return String(raw).replace(/^data:application\/pdf;base64,/, '').replace(/\s+/g, '').trim()
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const {
      aluno,
      responsavel,
      arquivoBase64,
      arquivos, // Array<{ nome: string; base64: string }>
      nomeArquivo = 'Documento_Matricula.pdf',
      nomeDocumento,
      authMode = 'tokenWhatsapp', // legacy fallback
      authModeContratante, // 'tokenWhatsapp' ou 'tokenEmail'
      authModeContratado, // 'tokenWhatsapp' ou 'tokenEmail'
      escolaInfo,
      assinarPelaEscola = false,
      escolaSignatario,
    } = body

    const effectiveAuthModeContratante = authModeContratante || authMode || 'tokenWhatsapp'
    const effectiveAuthModeContratado = authModeContratado || authMode || 'tokenWhatsapp'

    // Aluno é opcional: se não informado, segue como contrato avulso / direto
    const alunoNome = (aluno?.nome || '').trim()

    if (!responsavel?.nome) {
      return NextResponse.json(
        { error: 'Por favor, selecione ou informe o responsável que irá assinar.' },
        { status: 400 }
      )
    }

    const cleanRespCpf = (responsavel?.cpf || '').replace(/\D/g, '')

    const cleanPhone = formatPhoneForZapSign(responsavel?.telefone)
    const signerEmail = (responsavel?.email || '').trim()

    // Validações diretas dos canais do ZapSign para o Contratante
    if (effectiveAuthModeContratante === 'tokenWhatsapp' && !cleanPhone) {
      return NextResponse.json(
        { error: 'Para validação por WhatsApp do Contratante, informe ou confirme o número de telefone/celular com DDD do responsável.' },
        { status: 400 }
      )
    }

    if (effectiveAuthModeContratante === 'tokenEmail' && !signerEmail) {
      return NextResponse.json(
        { error: 'Para validação por E-mail do Contratante, informe ou confirme o endereço de e-mail do responsável.' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // 1. Obter configurações do ZapSign
    const { data: configRow } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', CONFIG_CHAVE)
      .maybeSingle()

    const config = configRow?.valor || {}
    const apiToken = config.apiToken || process.env.ZAPSIGN_API_TOKEN
    const isSandbox = Boolean(config.sandbox)

    if (!apiToken || !apiToken.trim()) {
      return NextResponse.json(
        {
          error: 'Token da API do ZapSign não configurado.',
          code: 'TOKEN_MISSING',
          message: 'Por favor, acesse a aba "Configurações ZapSign" e insira seu token de API para ativar o envio.'
        },
        { status: 422 }
      )
    }

    // 2. Definir e Processar o(s) PDF(s) com suporte a múltiplos arquivos (Fusão pdf-lib)
    let finalBase64 = ''
    let finalNomeArquivo = nomeArquivo
    const nomesDosArquivos: string[] = []

    if (Array.isArray(arquivos) && arquivos.length > 0) {
      if (arquivos.length === 1) {
        finalBase64 = cleanPdfBase64(arquivos[0].base64)
        finalNomeArquivo = arquivos[0].nome
        nomesDosArquivos.push(arquivos[0].nome)
      } else {
        // Fusão transparente de múltiplos PDFs em um único documento canônico
        const mergedPdf = await PDFDocument.create()
        for (const arq of arquivos) {
          nomesDosArquivos.push(arq.nome)
          const bytes = Buffer.from(cleanPdfBase64(arq.base64), 'base64')
          const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
          copiedPages.forEach(page => mergedPdf.addPage(page))
        }
        const mergedBytes = await mergedPdf.save()
        finalBase64 = Buffer.from(mergedBytes).toString('base64')
        finalNomeArquivo = `${arquivos.length} Documentos (${arquivos.map(a => a.nome).join(', ')})`
      }
    } else if (arquivoBase64) {
      finalBase64 = cleanPdfBase64(arquivoBase64)
      nomesDosArquivos.push(nomeArquivo)
    } else {
      // Se não anexou arquivo, gera um modelo institucional simplificado
      const contractData: ContractDataModel = {
        escolaNome: escolaInfo?.nome || 'COLÉGIO IMPACTO',
        escolaRazaoSocial: escolaInfo?.razaoSocial || 'Colégio Impacto Ltda',
        escolaCnpj: escolaInfo?.cnpj || '00.000.000/0001-00',
        escolaEndereco: escolaInfo?.endereco || 'Rua Principal, 100',
        escolaCidadeUf: escolaInfo?.cidadeUf || 'Campo Grande - MS',
        escolaTelefone: escolaInfo?.telefone || '(67) 3000-0000',
        escolaEmail: escolaInfo?.email || 'secretaria@colegioimpacto.com.br',

        alunoId: aluno?.id || '',
        alunoNome: alunoNome || 'Contrato Avulso',
        alunoCpf: aluno?.cpf || '',
        alunoRg: aluno?.rg || '',
        alunoDataNasc: aluno?.dataNascimento || aluno?.data_nascimento || '',
        alunoMatricula: aluno?.matricula || aluno?.codigo || '',
        alunoTurma: aluno?.turma_nome || aluno?.turma || '',
        alunoSerie: aluno?.serie || '',
        alunoTurno: aluno?.turno || 'Matutino',

        respNome: responsavel.nome,
        respCpf: responsavel.cpf || 'Não informado',
        respParentesco: responsavel.parentesco || 'Responsável',
        respTelefone: responsavel.telefone || '',
        respEmail: responsavel.email || '',

        anoLetivo: '2027',
        valorAnuidade: 0,
        valorMensalidade: 0,
        numParcelas: 12,
        descontoPercent: 0,
        diaVencimento: 10,
        tipoDocumento: 'contrato_servicos',
      }

      const generated = await gerarContratoPdf(contractData)
      finalBase64 = generated.base64Pdf
      nomesDosArquivos.push(generated.docName)
      finalNomeArquivo = generated.docName
    }

    const studentSuffix = alunoNome ? ` - ${alunoNome}` : ''
    const docTitle = nomeDocumento || (
      nomesDosArquivos.length > 1
        ? `Contrato e Anexos (${nomesDosArquivos.length} docs)${studentSuffix}`
        : (finalNomeArquivo ? finalNomeArquivo.replace(/\.pdf$/i, '') : `Contrato de Prestação de Serviços${studentSuffix}`)
    )

    // Se a escola também assina (Assinatura Bilateral: Contratado)
    const isAssinaturaBilateral = Boolean(assinarPelaEscola || escolaSignatario?.nomeRepresentante)
    let cleanEscolaCpf = ''
    let cleanEscolaPhone = ''
    let escolaEmail = ''

    if (isAssinaturaBilateral) {
      if (!escolaSignatario?.nomeRepresentante?.trim()) {
        return NextResponse.json(
          { error: 'O nome do representante da escola é obrigatório para a assinatura institucional.' },
          { status: 400 }
        )
      }
      cleanEscolaCpf = (escolaSignatario?.cpfRepresentante || '').replace(/\D/g, '')
      cleanEscolaPhone = formatPhoneForZapSign(escolaSignatario.telefone || escolaSignatario.celular)
      escolaEmail = (escolaSignatario.email || '').trim()

      if (effectiveAuthModeContratado === 'tokenWhatsapp' && !cleanEscolaPhone) {
        return NextResponse.json(
          { error: 'Para validação por WhatsApp do Contratado, o representante da instituição precisa ter um número de telefone/celular com DDD cadastrado.' },
          { status: 400 }
        )
      }

      if (effectiveAuthModeContratado === 'tokenEmail' && !escolaEmail) {
        return NextResponse.json(
          { error: 'Para validação por E-mail do Contratado, o representante da instituição precisa ter um endereço de e-mail cadastrado.' },
          { status: 400 }
        )
      }
    }

    // 3. Configurar Signatários para ZapSign (Contratante e Contratado)
    // requireCpf: true garante que a digitação do CPF será obrigatória diretamente no documento do ZapSign
    const signers: any[] = [
      {
        name: `${responsavel.nome.trim()} (Contratante)`,
        email: signerEmail || undefined,
        phoneNumber: cleanPhone || undefined,
        cpf: cleanRespCpf || undefined,
        requireCpf: true,
        qualification: responsavel.parentesco ? `Contratante (${responsavel.parentesco})` : 'Contratante',
        authMode: effectiveAuthModeContratante as any,
        sendAutomaticWhatsapp: effectiveAuthModeContratante === 'tokenWhatsapp',
        sendAutomaticEmail: effectiveAuthModeContratante === 'tokenEmail',
      },
    ]

    if (isAssinaturaBilateral && escolaSignatario?.nomeRepresentante) {
      const escolaCargo = escolaSignatario.cargo ? ` - ${escolaSignatario.cargo}` : ''
      const escolaName = `${escolaSignatario.nomeRepresentante.trim()} (Contratado)`

      signers.push({
        name: escolaName,
        email: escolaEmail || undefined,
        phoneNumber: cleanEscolaPhone || undefined,
        cpf: cleanEscolaCpf || undefined,
        requireCpf: true,
        qualification: `Contratado (${escolaSignatario.razaoSocial || 'Colégio Impacto'}${escolaCargo})`,
        authMode: effectiveAuthModeContratado as any,
        sendAutomaticWhatsapp: effectiveAuthModeContratado === 'tokenWhatsapp',
        sendAutomaticEmail: effectiveAuthModeContratado === 'tokenEmail',
      })
    }

    // 4. Chamar API do ZapSign
    const zapSignResponse = await criarDocumentoZapSign({
      name: docTitle,
      base64Pdf: finalBase64,
      signers,
      sandbox: isSandbox,
      apiToken,
      externalId: aluno?.id ? `aluno_${aluno.id}_${Date.now()}` : `doc_${Date.now()}`,
    })

    const signersResp = Array.isArray(zapSignResponse.signers) ? zapSignResponse.signers : []
    const firstSigner = signersResp[0]
    const escolaSigner = signersResp.length > 1 ? signersResp[1] : undefined
    const signUrl = firstSigner?.sign_url || ''
    const escolaSignUrl = escolaSigner?.sign_url || ''
    const docToken = zapSignResponse.token
    const signerToken = firstSigner?.token

    // 5. Salvar registro no sistema
    const contratoRecord = {
      id: uuidv4(),
      aluno_id: aluno?.id || '',
      aluno_nome: alunoNome || 'Avulso / Sem Estudante',
      aluno_cpf: aluno?.cpf || null,
      aluno_turma: aluno?.turma_nome || aluno?.turma || aluno?.serie || null,
      aluno_serie: aluno?.serie || null,
      responsavel_id: responsavel.id || null,
      responsavel_nome: responsavel.nome,
      responsavel_cpf: cleanRespCpf,
      responsavel_email: signerEmail || null,
      responsavel_telefone: responsavel.telefone || null,
      responsavel_parentesco: responsavel.parentesco || 'Responsável',
      ano_letivo: '2027',
      tipo_documento: finalNomeArquivo || 'Documento Anexo',
      valor_anuidade: 0,
      valor_mensalidade: 0,
      num_parcelas: 12,
      desconto_percent: 0,
      dia_vencimento: 10,
      zapsign_doc_token: docToken,
      zapsign_signer_token: signerToken,
      zapsign_sign_url: signUrl,
      zapsign_auth_mode: effectiveAuthModeContratante,
      zapsign_status: zapSignResponse.status || 'pending',
      status: 'aguardando',
      original_file_url: zapSignResponse.original_file || null,
      metadata: {
        docTitle,
        nomeArquivo: finalNomeArquivo,
        arquivos: nomesDosArquivos,
        totalArquivos: nomesDosArquivos.length,
        isSandbox,
        authMode: effectiveAuthModeContratante,
        authModeContratante: effectiveAuthModeContratante,
        authModeContratado: effectiveAuthModeContratado,
        assinarPelaEscola: Boolean(assinarPelaEscola),
        escolaSignatario: assinarPelaEscola && escolaSignatario ? { ...escolaSignatario, cpfRepresentante: cleanEscolaCpf } : null,
        escolaSignUrl: escolaSignUrl || null,
        signers: zapSignResponse.signers || [],
        createdAt: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    let saved = false
    try {
      const { data, error } = await supabase
        .from('matriculas_contratos')
        .insert(contratoRecord)
        .select()
        .single()

      if (!error && data) {
        saved = true
      }
    } catch (e) {
      saved = false
    }

    if (!saved) {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', FALLBACK_KEY)
        .maybeSingle()

      const currentList: any[] = Array.isArray(configData?.valor) ? configData.valor : []
      await supabase
        .from('configuracoes')
        .upsert({
          chave: FALLBACK_KEY,
          valor: [contratoRecord, ...currentList],
          updated_at: new Date().toISOString()
        }, { onConflict: 'chave' })
    }

    // 6. Link direto opcional para envio manual via WhatsApp
    const studentRef = alunoNome ? ` para o(a) aluno(a) *${alunoNome}*` : ''
    let whatsappLink = ''
    if (cleanPhone) {
      const msgTexto = encodeURIComponent(
        `Olá, ${responsavel.nome}!\n\n` +
        `Segue o documento do Colégio Impacto${studentRef}.\n\n` +
        `Por favor, acesse o link oficial abaixo para assinar eletronicamente via ZapSign:\n` +
        `${signUrl}\n\n` +
        `Qualquer dúvida, a Secretaria Escolar está à disposição!`
      )
      whatsappLink = `https://wa.me/55${cleanPhone}?text=${msgTexto}`
    }

    let escolaWhatsappLink = ''
    if (isAssinaturaBilateral && escolaSignatario && (escolaSignatario.telefone || escolaSignatario.celular)) {
      const cleanEscolaPhone = formatPhoneForZapSign(escolaSignatario.telefone || escolaSignatario.celular)
      if (cleanEscolaPhone && escolaSignUrl) {
        const msgEscola = encodeURIComponent(
          `Olá, ${escolaSignatario.nomeRepresentante}!\n\n` +
          `Segue o documento do Colégio Impacto${studentRef} para assinatura institucional como CONTRATADO (${escolaSignatario.razaoSocial || 'Colégio Impacto'}).\n\n` +
          `Acesse o link oficial abaixo para assinar eletronicamente via ZapSign:\n` +
          `${escolaSignUrl}\n\n` +
          `Secretaria Digital`
        )
        escolaWhatsappLink = `https://wa.me/55${cleanEscolaPhone}?text=${msgEscola}`
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Documento(s) anexado(s) e enviado(s) com sucesso pelo ZapSign!',
      contrato: contratoRecord,
      zapsign: {
        docToken,
        signerToken,
        signUrl,
        escolaSignUrl,
        whatsappLink,
        escolaWhatsappLink,
        authModeContratante: effectiveAuthModeContratante,
        authModeContratado: effectiveAuthModeContratado,
        status: zapSignResponse.status,
        signers: zapSignResponse.signers || []
      }
    })
  } catch (err: any) {
    console.error('[ZapSign Enviar Error]:', err)
    const isPlanError = String(err.message || '').includes('Plano de API')
    return NextResponse.json(
      { 
        error: err.message || 'Erro ao processar envio para o ZapSign.',
        code: isPlanError ? 'API_PLAN_REQUIRED' : 'SERVER_ERROR'
      },
      { status: isPlanError ? 402 : 500 }
    )
  }
}
