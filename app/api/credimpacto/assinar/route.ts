import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { dbGetEmprestimoById, dbSaveEmprestimo } from '@/lib/credimpacto/db'
import { resolveCredImpactoUser } from '@/lib/credimpacto/authHelper'
import { generateContractHtml } from '@/lib/credimpacto/contractTemplate'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { emprestimoId, senha, termoAceito, cpf } = body

    if (!emprestimoId) {
      return NextResponse.json({ error: 'Identificador do empréstimo é obrigatório.' }, { status: 400 })
    }

    if (!termoAceito) {
      return NextResponse.json({ error: 'Você precisa aceitar expressamente os termos do contrato e a autorização de desconto em folha.' }, { status: 400 })
    }

    const resolved = await resolveCredImpactoUser(user)
    const loan = await dbGetEmprestimoById(emprestimoId)

    if (!loan) {
      return NextResponse.json({ error: 'Empréstimo não encontrado.' }, { status: 404 })
    }

    const cleanStr = (s?: string) =>
      (s || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    const cleanDoc = (s?: string) => (s || '').replace(/\D/g, '')

    // Verificação resiliente de titularidade (por Auth ID, Funcionario ID, SystemUser ID, Email, CPF ou Nome completo)
    const matchesId =
      loan.colaboradorId === resolved.id ||
      Boolean(resolved.funcionarioId && loan.colaboradorId === resolved.funcionarioId) ||
      Boolean(resolved.systemUserId && loan.colaboradorId === resolved.systemUserId)

    const matchesEmail = Boolean(
      loan.colaboradorEmail &&
      resolved.email &&
      cleanStr(loan.colaboradorEmail) === cleanStr(resolved.email)
    )

    const matchesCpf = Boolean(
      loan.colaboradorCpf &&
      resolved.cpf &&
      cleanDoc(loan.colaboradorCpf) === cleanDoc(resolved.cpf) &&
      cleanDoc(loan.colaboradorCpf).length === 11
    )

    const matchesNome = Boolean(
      loan.colaboradorNome &&
      resolved.nome &&
      cleanStr(loan.colaboradorNome) === cleanStr(resolved.nome)
    )

    const isOwner = matchesId || matchesEmail || matchesCpf || matchesNome
    if (!isOwner) {
      return NextResponse.json({ error: 'Apenas o colaborador titular do empréstimo pode assinar o contrato.' }, { status: 403 })
    }

    // Processa CPF enviado no momento do aceite ou já existente
    const submittedCpfDigits = (cpf || loan.colaboradorCpf || resolved.cpf || '').replace(/\D/g, '')
    if (submittedCpfDigits.length === 11) {
      const formattedCpf = `${submittedCpfDigits.slice(0, 3)}.${submittedCpfDigits.slice(3, 6)}.${submittedCpfDigits.slice(6, 9)}-${submittedCpfDigits.slice(9, 11)}`
      loan.colaboradorCpf = formattedCpf

      // Sincroniza o CPF nos registros do funcionário e system_user para completar o cadastro
      try {
        const { supabaseServer } = await import('@/lib/supabaseServer')
        if (resolved.funcionarioId) {
          await supabaseServer.from('funcionarios').update({ cpf: formattedCpf }).eq('id', resolved.funcionarioId)
        }
        if (resolved.systemUserId) {
          await supabaseServer.from('system_users').update({ cpf: formattedCpf }).eq('id', resolved.systemUserId)
        }
      } catch (syncErr) {
        console.error('[CredImpacto] Erro ao sincronizar CPF com tabelas funcionais:', syncErr)
      }
    } else {
      return NextResponse.json({
        error: 'É obrigatório informar um CPF válido (11 dígitos) para assinar e formalizar o contrato de mútuo.'
      }, { status: 400 })
    }

    // Corrige dados do titular no contrato caso tenham vindo genéricos do criador
    if (resolved.email && (!loan.colaboradorEmail || loan.colaboradorEmail.toLowerCase() !== resolved.email.toLowerCase())) {
      loan.colaboradorEmail = resolved.email
    }
    if (!loan.colaboradorUnidade && resolved.unidade) {
      loan.colaboradorUnidade = resolved.unidade
    }

    if (loan.status !== 'aguardando_assinatura') {
      return NextResponse.json({
        error: `O contrato não está no estado aguardando assinatura. Status atual: ${loan.status}`
      }, { status: 400 })
    }

    // 1. Validação de senha para garantia de não-repúdio (se fornecida senha)
    if (senha && user.email) {
      const supabaseAnon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
        email: user.email,
        password: senha
      })
      if (signInError) {
        return NextResponse.json({ error: 'Senha incorreta para validação da assinatura eletrônica.' }, { status: 401 })
      }
    }

    // 2. Coleta de evidências forenses e de auditoria
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Navegador não identificado'
    const nowIso = new Date().toISOString()

    // 3. Código único de verificação (ex: VAL-CRED-A1B2-C3D4)
    const randPart = crypto.randomBytes(4).toString('hex').toUpperCase()
    const codigoVerificacao = `VAL-CRED-${randPart.slice(0, 4)}-${randPart.slice(4)}`

    // 4. Hash SHA-256 do contrato + metadados
    const payloadToHash = `${loan.id}|${loan.codigoOperacao}|${loan.colaboradorCpf}|${loan.valorAprovado}|${loan.totalAPagar}|${nowIso}|${ip}|${userAgent}`
    const hashSha256 = crypto.createHash('sha256').update(payloadToHash).digest('hex')

    // 5. Atualiza o empréstimo
    loan.status = 'aguardando_liberacao'
    loan.assinadoEm = nowIso
    loan.assinanteIp = ip
    loan.assinanteUserAgent = userAgent
    loan.assinanteDocumento = loan.colaboradorCpf
    loan.codigoVerificacaoAssinatura = codigoVerificacao
    loan.contratoHashSha256 = hashSha256

    // Busca os dados da unidade escolar onde o colaborador está cadastrado
    const { getDadosUnidadeEscolar } = await import('@/lib/credimpacto/unitHelper')
    const dadosUnidade = await getDadosUnidadeEscolar(loan.colaboradorUnidade || resolved.unidade)

    // Regenera o contrato agora com a unidade correta, carimbo e hash devidamente registrados
    loan.contratoConteudoHtml = generateContractHtml(loan, {
      razaoSocialEscola: dadosUnidade.razaoSocial,
      nomeFantasiaEscola: dadosUnidade.nomeFantasia,
      cnpjEscola: dadosUnidade.cnpj,
      enderecoEscola: dadosUnidade.endereco,
      cidadeUfEscola: dadosUnidade.cidadeUf,
      unidadeEscola: dadosUnidade.unidadeNome,
      termoAutorizacaoDesconto: loan.termoAutorizacaoDesconto
    })

    const updated = await dbSaveEmprestimo(
      loan,
      { id: resolved.id, nome: resolved.nome, perfil: resolved.perfil },
      'ASSINATURA',
      `Assinatura eletrônica confirmada pelo colaborador via IP ${ip} (Hash SHA-256: ${hashSha256.slice(0, 16)}...)`
    )

    return NextResponse.json({
      success: true,
      emprestimo: updated,
      codigoVerificacao,
      hashSha256,
      assinadoEm: nowIso
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar assinatura eletrônica' }, { status: 400 })
  }
}
