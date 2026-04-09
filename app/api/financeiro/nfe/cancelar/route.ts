import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { unidade, provedorId, numero, chaveNFSe, motivo } = await req.json()

    if (!unidade?.cnpj) {
      return NextResponse.json({ success: false, error: 'Unidade Fiscal inválida.' }, { status: 400 })
    }

    const provedor = unidade.provedor || 'mock'

    // ── NFE.io ──────────────────────────────────────────────────────────────────
    if (provedor === 'nfeio') {
      const companyId = unidade.companyId || unidade.cnpj.replace(/\D/g, '')
      const res = await fetch(`https://api.nfe.io/v2/companies/${companyId}/serviceinvoices/${provedorId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${Buffer.from(`${unidade.apiKey}:`).toString('base64')}` }
      })
      if (res.ok || res.status === 204) {
        return NextResponse.json({ success: true, status: 'cancelada', message: 'NFS-e cancelada no provedor NFE.io.' })
      }
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ success: false, error: data.message || `HTTP ${res.status}` })
    }

    // ── eNotas ──────────────────────────────────────────────────────────────────
    if (provedor === 'enotas') {
      const cnpj = unidade.cnpj.replace(/\D/g, '')
      const res = await fetch(`https://api.enotas.com.br/v2/Empresa/${cnpj}/Nfse/${provedorId}/Cancelar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`:${unidade.apiKey}`).toString('base64')}`,
        },
        body: JSON.stringify({ motivo: motivo || 'Cancelamento solicitado pelo prestador' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return NextResponse.json({ success: true, status: 'cancelada' })
      return NextResponse.json({ success: false, error: data.message || `HTTP ${res.status}` })
    }

    // ── ABRASF direto ──────────────────────────────────────────────────────────
    if (provedor === 'abrasf' && unidade.urlWebservice) {
      const cnpjLimpo = unidade.cnpj.replace(/\D/g, '')
      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CancelarNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
      <Pedido>
        <InfPedidoCancelamento>
          <IdentificacaoNfse>
            <Numero>${numero}</Numero>
            <CpfCnpj><Cnpj>${cnpjLimpo}</Cnpj></CpfCnpj>
            <InscricaoMunicipal>${unidade.inscricaoMunicipal}</InscricaoMunicipal>
            <CodigoMunicipio>${unidade.codigoMunicipio || ''}</CodigoMunicipio>
          </IdentificacaoNfse>
          <CodigoCancelamento>1</CodigoCancelamento>
        </InfPedidoCancelamento>
      </Pedido>
    </CancelarNfse>
  </soap:Body>
</soap:Envelope>`

      const res = await fetch(unidade.urlWebservice, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'CancelarNfse' },
        body: soapBody,
      })
      const xml = await res.text()
      const sucesso = xml.includes('DataHoraCancelamento') || xml.includes('Cancelamento')
      const erro = xml.match(/<Mensagem>(.*?)<\/Mensagem>/)?.[1]
      return NextResponse.json({ success: sucesso, status: sucesso ? 'cancelada' : 'erro', error: erro })
    }

    // ── Mock ───────────────────────────────────────────────────────────────────
    return NextResponse.json({ success: true, status: 'cancelada', message: 'Cancelamento registrado (mock).' })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
