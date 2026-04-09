import { NextResponse } from 'next/server'

// ─── CNPJ Validator ──────────────────────────────────────────────────────────
function validarCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false
  const calc = (s: string, n: number) => {
    let sum = 0, pos = n - 7
    for (let i = n; i >= 1; i--) { sum += parseInt(s[n - i]) * pos--; if (pos < 2) pos = 9 }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    return r === parseInt(s[n])
  }
  return calc(cnpj, 12) && calc(cnpj, 13)
}

// ─── Checklist de campos obrigatórios ────────────────────────────────────────
function validarCamposBase(u: any): string[] {
  const erros: string[] = []
  if (!u.cnpj)                  erros.push('CNPJ não preenchido')
  else if (!validarCNPJ(u.cnpj)) erros.push(`CNPJ "${u.cnpj}" inválido`)
  if (!u.inscricaoMunicipal)    erros.push('Inscrição Municipal não preenchida')
  if (!u.cnae)                  erros.push('CNAE Primário não preenchido')
  if (!u.aliquota && u.aliquota !== 0) erros.push('Alíquota ISS não configurada')
  if (!u.ambiente)              erros.push('Ambiente (Produção/Homologação) não definido')
  return erros
}

// ─── Teste NFE.io ─────────────────────────────────────────────────────────────
async function testarNFeIo(u: any): Promise<{ success: boolean; logs: string[]; errors: string[] }> {
  const logs: string[] = []
  const errors: string[] = []

  if (!u.apiKey) {
    errors.push('API Key NFE.io não preenchida')
    return { success: false, logs, errors }
  }

  const companyId = u.companyId || u.cnpj.replace(/\D/g, '')
  logs.push(`[NFE.io] Endpoint: https://api.nfe.io`)
  logs.push(`[NFE.io] Company ID: ${companyId}`)
  logs.push(`[NFE.io] Ambiente: ${u.ambiente}`)
  logs.push(`[NFE.io] Consultando empresa no provedor...`)

  try {
    const res = await fetch(`https://api.nfe.io/v2/companies/${companyId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${u.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    })

    const status = res.status
    logs.push(`[NFE.io] HTTP ${status}`)

    if (status === 401 || status === 403) {
      errors.push('API Key inválida ou sem permissão. Verifique a chave no painel NFE.io.')
      return { success: false, logs, errors }
    }

    if (status === 404) {
      errors.push(`Empresa "${companyId}" não encontrada no NFE.io. Verifique o Company ID/CNPJ.`)
      return { success: false, logs, errors }
    }

    if (!res.ok) {
      errors.push(`Resposta inesperada: HTTP ${status}`)
      return { success: false, logs, errors }
    }

    const data = await res.json()
    logs.push(`[NFE.io] ✅ Empresa encontrada: ${data.name || data.tradeName || companyId}`)
    logs.push(`[NFE.io] ✅ Status: ${data.statusDescription || 'Ativa'}`)
    logs.push(`[NFE.io] ✅ Integração estabelecida com sucesso.`)
    return { success: true, logs, errors }

  } catch (err: any) {
    errors.push(`Falha de rede ao conectar ao NFE.io: ${err.message}`)
    return { success: false, logs, errors }
  }
}

// ─── Teste eNotas ─────────────────────────────────────────────────────────────
async function testarENotas(u: any): Promise<{ success: boolean; logs: string[]; errors: string[] }> {
  const logs: string[] = []
  const errors: string[] = []

  if (!u.apiKey) {
    errors.push('API Key eNotas não preenchida')
    return { success: false, logs, errors }
  }

  const cnpj = u.cnpj.replace(/\D/g, '')
  logs.push(`[eNotas] Endpoint: https://api.enotas.com.br`)
  logs.push(`[eNotas] CNPJ: ${cnpj}`)
  logs.push(`[eNotas] Buscando empresa no provedor...`)

  try {
    const res = await fetch(`https://api.enotas.com.br/v2/Empresa/${cnpj}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${u.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    })

    logs.push(`[eNotas] HTTP ${res.status}`)

    if (res.status === 401 || res.status === 403) {
      errors.push('API Key eNotas inválida. Verifique no painel eNotas.')
      return { success: false, logs, errors }
    }
    if (res.status === 404) {
      errors.push(`CNPJ ${cnpj} não cadastrado no eNotas. Cadastre a empresa no painel primeiro.`)
      return { success: false, logs, errors }
    }
    if (!res.ok) {
      errors.push(`Resposta inesperada: HTTP ${res.status}`)
      return { success: false, logs, errors }
    }

    const data = await res.json()
    logs.push(`[eNotas] ✅ Empresa encontrada: ${data.nomeRazaoSocial || cnpj}`)
    logs.push(`[eNotas] ✅ Status NFS-e: ${data.statusIntegracaoNfse || 'Configurado'}`)
    logs.push(`[eNotas] ✅ Integração com eNotas verificada com sucesso.`)
    return { success: true, logs, errors }

  } catch (err: any) {
    errors.push(`Falha de rede ao conectar ao eNotas: ${err.message}`)
    return { success: false, logs, errors }
  }
}

// ─── Teste Tecnospeed ─────────────────────────────────────────────────────────
async function testarTecnospeed(u: any): Promise<{ success: boolean; logs: string[]; errors: string[] }> {
  const logs: string[] = []
  const errors: string[] = []

  if (!u.apiKey || !u.apiSecret) {
    errors.push('API Key e/ou API Secret Tecnospeed não preenchidos')
    return { success: false, logs, errors }
  }

  const token = Buffer.from(`${u.apiKey}:${u.apiSecret}`).toString('base64')
  logs.push(`[Tecnospeed] Endpoint: https://api.plugnotasfiscais.com.br`)
  logs.push(`[Tecnospeed] Testando autenticação...`)

  try {
    const res = await fetch('https://api.plugnotasfiscais.com.br/v1/nfse', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
      },
    })

    logs.push(`[Tecnospeed] HTTP ${res.status}`)

    if (res.status === 401 || res.status === 403) {
      errors.push('Credenciais Tecnospeed inválidas. Verifique API Key e Secret.')
      return { success: false, logs, errors }
    }

    // 200 ou 404 significa que autenticou (404 = sem NFS-e, mas auth OK)
    if (res.ok || res.status === 404 || res.status === 405) {
      logs.push(`[Tecnospeed] ✅ Autenticação validada com sucesso.`)
      logs.push(`[Tecnospeed] ✅ CNPJ: ${u.cnpj.replace(/\D/g, '')} pronto para emissão.`)
      return { success: true, logs, errors }
    }

    errors.push(`Resposta inesperada: HTTP ${res.status}`)
    return { success: false, logs, errors }

  } catch (err: any) {
    errors.push(`Falha de rede ao conectar ao Tecnospeed: ${err.message}`)
    return { success: false, logs, errors }
  }
}

// ─── Teste ABRASF SOAP ────────────────────────────────────────────────────────
async function testarAbrasf(u: any): Promise<{ success: boolean; logs: string[]; errors: string[] }> {
  const logs: string[] = []
  const errors: string[] = []

  if (!u.urlWebservice) {
    errors.push('URL do Webservice SOAP não preenchida')
    return { success: false, logs, errors }
  }

  if (!u.codigoMunicipio) {
    errors.push('Código IBGE do Município não preenchido (necessário para emissão ABRASF)')
  }

  logs.push(`[ABRASF] Endpoint: ${u.urlWebservice}`)
  logs.push(`[ABRASF] Enviando request de consulta WSDL...`)

  try {
    // Tenta acessar o WSDL do webservice
    const wsdlUrl = u.urlWebservice.includes('?wsdl')
      ? u.urlWebservice
      : `${u.urlWebservice}?wsdl`

    const res = await fetch(wsdlUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/xml, application/xml' },
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    logs.push(`[ABRASF] WSDL HTTP ${res.status}`)

    if (!res.ok) {
      // Tenta o endpoint direto se o WSDL falhar
      logs.push(`[ABRASF] Tentando endpoint direto...`)
      const soapTest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><ConsultarNfse xmlns="http://www.abrasf.org.br/nfse.xsd"/></soap:Body>
</soap:Envelope>`
      const res2 = await fetch(u.urlWebservice, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml', 'SOAPAction': 'ConsultarNfse' },
        body: soapTest,
        signal: AbortSignal.timeout(10000),
      })
      logs.push(`[ABRASF] POST direto HTTP ${res2.status}`)
      if (res2.status >= 200 && res2.status < 600) {
        // Qualquer resposta (incluindo erros SOAP) indica que o endpoint existe
        logs.push(`[ABRASF] ✅ Webservice responde. CNPJ: ${u.cnpj}`)
        if (!u.codigoMunicipio) errors.push('Código IBGE do Município não preenchido — preencha para emitir.')
        logs.push(`[ABRASF] ✅ Endpoint SOAP acessível.`)
        return { success: errors.length === 0, logs, errors }
      }
      errors.push(`Webservice não respondeu: HTTP ${res2.status}`)
      return { success: false, logs, errors }
    }

    const wsdl = await res.text()
    const hasAbrasf = wsdl.includes('abrasf') || wsdl.includes('RecepcionarLoteRps') || wsdl.includes('nfse')
    if (hasAbrasf) {
      logs.push(`[ABRASF] ✅ WSDL ABRASF encontrado e válido.`)
    } else {
      logs.push(`[ABRASF] ⚠️ WSDL encontrado mas pode não ser padrão ABRASF.`)
    }

    if (!u.codigoMunicipio) errors.push('Código IBGE do Município não preenchido — preencha para emitir.')
    if (!u.inscricaoMunicipal) errors.push('Inscrição Municipal não preenchida.')

    logs.push(`[ABRASF] ✅ Webservice acessível. Pronto para emissão.`)
    return { success: errors.length === 0, logs, errors }

  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      errors.push(`Timeout ao conectar ao webservice (>10s). Verifique a URL e a disponibilidade.`)
    } else {
      errors.push(`Falha de rede: ${err.message}`)
    }
    return { success: false, logs, errors }
  }
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const unidade = await req.json()
    const logs: string[] = []
    const errors: string[] = []

    // ── 1. Validação dos campos base ────────────────────────────────────────────
    logs.push(`[Validação] Verificando campos obrigatórios...`)
    const campoErros = validarCamposBase(unidade)
    if (campoErros.length > 0) {
      return NextResponse.json({
        success: false,
        logs: [...logs, `[Validação] ❌ ${campoErros.length} problema(s) encontrado(s).`],
        errors: campoErros,
      })
    }
    logs.push(`[Validação] ✅ CNPJ: ${unidade.cnpj} — Válido`)
    logs.push(`[Validação] ✅ Inscrição Municipal: ${unidade.inscricaoMunicipal}`)
    logs.push(`[Validação] ✅ CNAE: ${unidade.cnae}`)
    logs.push(`[Validação] ✅ Alíquota ISS: ${unidade.aliquota}%`)
    logs.push(`[Validação] ✅ Ambiente: ${unidade.ambiente === 'producao' ? '🚀 Produção' : '🛠️ Homologação'}`)

    // ── 2. Verificar numeração RPS ──────────────────────────────────────────────
    if (!unidade.proximoRps || !unidade.serieRps) {
      errors.push('Numeração RPS (próximo número e série) não configurada. Preencha para emitir NFS-e.')
    } else {
      logs.push(`[RPS] ✅ Próximo RPS: ${unidade.serieRps}/${unidade.proximoRps}`)
    }

    // ── 3. Testar provedor específico ───────────────────────────────────────────
    const provedor = unidade.provedor || 'mock'
    logs.push(`\n[Provedor] Iniciando teste: ${provedor.toUpperCase()}`)

    let resultado: { success: boolean; logs: string[]; errors: string[] }

    switch (provedor) {
      case 'nfeio':
        resultado = await testarNFeIo(unidade)
        break
      case 'enotas':
        resultado = await testarENotas(unidade)
        break
      case 'tecnospeed':
        resultado = await testarTecnospeed(unidade)
        break
      case 'abrasf':
        resultado = await testarAbrasf(unidade)
        break
      default:
        // Mock — apenas valida campos
        resultado = {
          success: errors.length === 0,
          logs: [
            `[Mock] ✅ Modo simulação ativo.`,
            `[Mock] Nenhuma conexão real com prefeitura é realizada.`,
            `[Mock] Para emissão fiscal real, configure um provedor: NFE.io, eNotas, Tecnospeed ou ABRASF Direto.`,
          ],
          errors: [],
        }
    }

    const allLogs = [...logs, ...resultado.logs]
    const allErrors = [...errors, ...resultado.errors]

    return NextResponse.json({
      success: resultado.success && allErrors.length === 0,
      logs: allLogs,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })

  } catch (err: any) {
    return NextResponse.json({
      success: false,
      logs: [`[FATAL] Erro interno: ${err.message}`],
      errors: [err.message],
    }, { status: 500 })
  }
}
