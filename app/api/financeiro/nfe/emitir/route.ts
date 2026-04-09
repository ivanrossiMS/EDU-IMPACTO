import { NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NFePayload {
  unidade: {
    id: string
    cnpj: string
    inscricaoMunicipal: string
    cnae: string
    municipio: string
    codigoMunicipio?: string
    uf?: string
    ambiente: 'homologacao' | 'producao'
    aliquota: number
    tributacao: string
    provedor?: string
    apiKey?: string
    apiSecret?: string
    companyId?: string
    urlWebservice?: string
    proximoRps?: number
    serieRps?: string
    email?: string
    telefone?: string
    logradouro?: string
    numero?: string
    bairro?: string
    cep?: string
  }
  nota: {
    aluno: string
    responsavel: string
    tomadorCpfCnpj?: string
    tomadorEmail?: string
    valor: number
    competencia: string
    descricao: string
    rpsNumero?: number
    rpsSerie?: string
  }
}

interface NFeResult {
  success: boolean
  numero?: string
  chaveNFSe?: string
  protocolo?: string
  provedorId?: string
  linkVisualizacao?: string
  linkDownloadPdf?: string
  xmlRps?: string
  xmlRetorno?: string
  erroDescricao?: string
  erroCorrecao?: string
  status: 'emitida' | 'processando' | 'erro'
  logs: string[]
}

// ─── Estratégia NFE.io ────────────────────────────────────────────────────────
// Documentação: https://nfe.io/docs/nota-fiscal-servico/emissao-nota-servico/
async function emitirViaNFeIo(payload: NFePayload): Promise<NFeResult> {
  const { unidade, nota } = payload
  const logs: string[] = []

  if (!unidade.apiKey) {
    return { success: false, status: 'erro', erroDescricao: 'API Key NFE.io não configurada na Unidade Fiscal.', logs }
  }

  const companyId = unidade.companyId || unidade.cnpj.replace(/\D/g, '')
  const baseUrl = 'https://api.nfe.io'

  logs.push(`[NFE.io] Iniciando emissão via API REST...`)
  logs.push(`[NFE.io] Company: ${companyId} | Ambiente: ${unidade.ambiente}`)

  const body = {
    cityServiceCode: unidade.cnae,
    description: nota.descricao || `Serviços educacionais - ${nota.aluno} - ${nota.competencia}`,
    servicesAmount: nota.valor,
    borrower: {
      name: nota.responsavel,
      federalTaxNumber: nota.tomadorCpfCnpj?.replace(/\D/g, '') || undefined,
      email: nota.tomadorEmail || undefined,
    },
    competence: nota.competencia ? `${nota.competencia}-01T00:00:00` : new Date().toISOString(),
    issRate: unidade.aliquota / 100,
    deductionsAmount: 0,
    discountUnconditionalAmount: 0,
  }

  try {
    const res = await fetch(`${baseUrl}/v2/companies/${companyId}/serviceinvoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${unidade.apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    logs.push(`[NFE.io] HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`)

    if (res.ok && data.id) {
      logs.push(`[NFE.io] Nota criada com ID: ${data.id} | Status: ${data.flowStatus}`)
      return {
        success: true,
        status: data.flowStatus === 'Issued' ? 'emitida' : 'processando',
        numero: data.number || data.id,
        chaveNFSe: data.checkCode,
        provedorId: data.id,
        linkVisualizacao: data.viewerUrl,
        linkDownloadPdf: data.downloadUrl,
        logs,
      }
    }

    return {
      success: false,
      status: 'erro',
      erroDescricao: data.message || `Erro HTTP ${res.status}`,
      erroCorrecao: data.errors?.join('; '),
      logs,
    }
  } catch (err: any) {
    return { success: false, status: 'erro', erroDescricao: `Erro de rede: ${err.message}`, logs }
  }
}

// ─── Estratégia eNotas ────────────────────────────────────────────────────────
// Documentação: https://enotas.com.br/api
async function emitirViaENotas(payload: NFePayload): Promise<NFeResult> {
  const { unidade, nota } = payload
  const logs: string[] = []

  if (!unidade.apiKey) {
    return { success: false, status: 'erro', erroDescricao: 'API Key eNotas não configurada na Unidade Fiscal.', logs }
  }

  const baseUrl = 'https://api.enotas.com.br'
  logs.push(`[eNotas] Iniciando emissão...`)

  const cnpjLimpo = unidade.cnpj.replace(/\D/g, '')
  const body = {
    ambienteEmissao: unidade.ambiente === 'producao' ? 'Producao' : 'Homologacao',
    externalId: `ERP-${Date.now()}`,
    tipo: 'NFS-e',
    servico: {
      descricao: nota.descricao || `Serviços educacionais - ${nota.aluno} - ${nota.competencia}`,
      valorServicos: nota.valor,
      aliquotaIss: unidade.aliquota,
      codigoTributacaoMunicipal: unidade.cnae,
      issRetidoFonte: false,
    },
    tomador: {
      nomeRazaoSocial: nota.responsavel,
      cpfCnpj: nota.tomadorCpfCnpj?.replace(/\D/g, '') || undefined,
      email: nota.tomadorEmail || undefined,
    },
    dataCompetencia: nota.competencia ? `${nota.competencia}-01` : undefined,
  }

  try {
    const res = await fetch(`${baseUrl}/v2/Empresa/${cnpjLimpo}/Nfse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`:${unidade.apiKey}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    logs.push(`[eNotas] HTTP ${res.status}`)

    if (res.ok && data.id) {
      return {
        success: true,
        status: data.status === 'Emitida' ? 'emitida' : 'processando',
        numero: data.numero || data.id,
        chaveNFSe: data.codigoVerificacao,
        provedorId: data.id,
        linkVisualizacao: data.urlNfse,
        logs,
      }
    }

    return {
      success: false,
      status: 'erro',
      erroDescricao: data.message || data.erros?.[0]?.mensagem || `Erro HTTP ${res.status}`,
      logs,
    }
  } catch (err: any) {
    return { success: false, status: 'erro', erroDescricao: `Erro de rede: ${err.message}`, logs }
  }
}

// ─── Estratégia Tecnospeed ────────────────────────────────────────────────────
async function emitirViaTecnospeed(payload: NFePayload): Promise<NFeResult> {
  const { unidade, nota } = payload
  const logs: string[] = []

  if (!unidade.apiKey || !unidade.apiSecret) {
    return { success: false, status: 'erro', erroDescricao: 'API Key e Secret Tecnospeed não configurados.', logs }
  }

  const baseUrl = 'https://api.plugnotasfiscais.com.br'
  logs.push(`[Tecnospeed] Iniciando emissão...`)

  const token = Buffer.from(`${unidade.apiKey}:${unidade.apiSecret}`).toString('base64')
  const body = {
    prestador: { cpfCnpj: unidade.cnpj.replace(/\D/g, '') },
    tomador: {
      razaoSocial: nota.responsavel,
      cpfCnpj: nota.tomadorCpfCnpj?.replace(/\D/g, ''),
    },
    servico: {
      aliquotaIss: unidade.aliquota,
      discriminacao: nota.descricao || `Serviços educacionais - ${nota.aluno}`,
      iss: { tipo: 'nenhum' },
      valorServicos: nota.valor,
      codigoTributacaoMunicipio: unidade.cnae,
    },
    dataCompetencia: nota.competencia ? `${nota.competencia}-01` : new Date().toISOString().slice(0, 10),
    ambiente: unidade.ambiente === 'producao' ? 'producao' : 'homologacao',
  }

  try {
    const res = await fetch(`${baseUrl}/v1/nfse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    logs.push(`[Tecnospeed] HTTP ${res.status}`)

    if (res.ok) {
      return {
        success: true,
        status: 'processando',
        provedorId: data.id,
        numero: data.numero,
        logs,
      }
    }

    return {
      success: false,
      status: 'erro',
      erroDescricao: data.message || `Erro HTTP ${res.status}`,
      logs,
    }
  } catch (err: any) {
    return { success: false, status: 'erro', erroDescricao: `Erro de rede: ${err.message}`, logs }
  }
}

// ─── Estratégia ABRASF Direto (SOAP) ─────────────────────────────────────────
// Gera o XML RPS e envia direto ao webservice municipal
async function emitirAbrafDireto(payload: NFePayload): Promise<NFeResult> {
  const { unidade, nota } = payload
  const logs: string[] = []

  if (!unidade.urlWebservice) {
    return {
      success: false, status: 'erro',
      erroDescricao: 'URL do webservice municipal não configurada. Preencha "URL Webservice SOAP" na Unidade Fiscal.',
      erroCorrecao: 'Obtenha a URL no portal da prefeitura municipal e adicione nas configurações da Unidade Fiscal.',
      logs
    }
  }

  const rpsNum = (unidade.proximoRps || 1).toString()
  const rpsSerie = unidade.serieRps || 'A'
  const cnpjLimpo = unidade.cnpj.replace(/\D/g, '')
  const competDate = nota.competencia ? `${nota.competencia}-01` : new Date().toISOString().slice(0, 10)

  // Gerar XML RPS padrão ABRASF 2.01
  const xmlRps = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps Id="lote1">
    <NumeroLote>1</NumeroLote>
    <CpfCnpj><Cnpj>${cnpjLimpo}</Cnpj></CpfCnpj>
    <InscricaoMunicipal>${unidade.inscricaoMunicipal}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfRps Id="rps${rpsNum}">
          <IdentificacaoRps>
            <Numero>${rpsNum}</Numero>
            <Serie>${rpsSerie}</Serie>
            <Tipo>1</Tipo>
          </IdentificacaoRps>
          <DataEmissao>${new Date().toISOString()}</DataEmissao>
          <Status>1</Status>
          <Servico>
            <Valores>
              <ValorServicos>${nota.valor.toFixed(2)}</ValorServicos>
              <ValorDeducoes>0.00</ValorDeducoes>
              <ValorIss>${(nota.valor * unidade.aliquota / 100).toFixed(2)}</ValorIss>
              <Aliquota>${(unidade.aliquota / 100).toFixed(4)}</Aliquota>
              <BaseCalculo>${nota.valor.toFixed(2)}</BaseCalculo>
              <ValorIssRetido>0.00</ValorIssRetido>
              <ValorLiquidoNfse>${(nota.valor - nota.valor * unidade.aliquota / 100).toFixed(2)}</ValorLiquidoNfse>
            </Valores>
            <IssRetido>2</IssRetido>
            <ItemListaServico>${unidade.cnae}</ItemListaServico>
            <Discriminacao>${nota.descricao || `Servicos educacionais - ${nota.aluno} - Competencia: ${nota.competencia}`}</Discriminacao>
            <CodigoMunicipio>${unidade.codigoMunicipio || '0000000'}</CodigoMunicipio>
          </Servico>
          <Prestador>
            <CpfCnpj><Cnpj>${cnpjLimpo}</Cnpj></CpfCnpj>
            <InscricaoMunicipal>${unidade.inscricaoMunicipal}</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>${nota.tomadorCpfCnpj ? `<Cpf>${nota.tomadorCpfCnpj.replace(/\D/g,'').padStart(11,'0').slice(0,11)}</Cpf>` : '<CpfCnpj/>'}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${nota.responsavel}</RazaoSocial>
          </Tomador>
          <OptanteSimplesNacional>1</OptanteSimplesNacional>
          <IncentivoFiscal>2</IncentivoFiscal>
        </InfRps>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`

  logs.push(`[ABRASF] XML RPS gerado. Série: ${rpsSerie} | Nº: ${rpsNum}`)
  logs.push(`[ABRASF] Transmitindo para: ${unidade.urlWebservice}`)

  try {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="http://www.abrasf.org.br/nfse.xsd">
  <soap:Header/>
  <soap:Body>
    <nfse:RecepcionarLoteRps>${xmlRps}</nfse:RecepcionarLoteRps>
  </soap:Body>
</soap:Envelope>`

    const res = await fetch(unidade.urlWebservice, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'RecepcionarLoteRps',
      },
      body: soapBody,
    })

    const xmlRetorno = await res.text()
    logs.push(`[ABRASF] HTTP ${res.status} | Resposta: ${xmlRetorno.slice(0, 300)}`)

    if (!res.ok) {
      return {
        success: false, status: 'erro',
        erroDescricao: `Webservice retornou HTTP ${res.status}`,
        xmlRps, xmlRetorno, logs,
      }
    }

    // Parse protocolo e número da NFS-e do XML de retorno
    const protocolo = xmlRetorno.match(/<Protocolo>(.*?)<\/Protocolo>/)?.[1]
    const numero = xmlRetorno.match(/<Numero>(.*?)<\/Numero>/)?.[1]
    const chave = xmlRetorno.match(/<CodigoVerificacao>(.*?)<\/CodigoVerificacao>/)?.[1]
    const erroMsg = xmlRetorno.match(/<Mensagem>(.*?)<\/Mensagem>/)?.[1]
    const erroCor = xmlRetorno.match(/<Correcao>(.*?)<\/Correcao>/)?.[1]

    if (erroMsg) {
      return { success: false, status: 'erro', erroDescricao: erroMsg, erroCorrecao: erroCor, xmlRps, xmlRetorno, logs }
    }

    logs.push(`[ABRASF] Protocolo: ${protocolo} | NFS-e Nº: ${numero}`)
    return {
      success: true,
      status: protocolo && !numero ? 'processando' : 'emitida',
      numero: numero || rpsNum,
      protocolo,
      chaveNFSe: chave,
      xmlRps,
      xmlRetorno,
      logs,
    }
  } catch (err: any) {
    return { success: false, status: 'erro', erroDescricao: `Falha ao conectar ao webservice: ${err.message}`, xmlRps, logs }
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const payload: NFePayload = await req.json()
    const { unidade, nota } = payload

    if (!unidade?.cnpj || !nota?.valor) {
      return NextResponse.json({ success: false, erroDescricao: 'Dados insuficientes para emissão.' }, { status: 400 })
    }

    const provedor = unidade.provedor || 'mock'
    let resultado: NFeResult

    switch (provedor) {
      case 'nfeio':
        resultado = await emitirViaNFeIo(payload)
        break
      case 'enotas':
        resultado = await emitirViaENotas(payload)
        break
      case 'tecnospeed':
        resultado = await emitirViaTecnospeed(payload)
        break
      case 'abrasf':
        resultado = await emitirAbrafDireto(payload)
        break
      default:
        // Modo mock - gera número fictício para testes
        await new Promise(r => setTimeout(r, 800))
        resultado = {
          success: true,
          status: 'emitida',
          numero: Math.floor(100000 + Math.random() * 900000).toString(),
          chaveNFSe: `MOCK-${Date.now().toString(36).toUpperCase()}`,
          protocolo: `PROT-${Date.now()}`,
          logs: ['[MOCK] Emissão simulada com sucesso. Configure um provedor real na Unidade Fiscal.'],
        }
    }

    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      status: 'erro',
      erroDescricao: `Erro interno: ${err.message}`,
      logs: [`[FATAL] ${err.message}`],
    }, { status: 500 })
  }
}
