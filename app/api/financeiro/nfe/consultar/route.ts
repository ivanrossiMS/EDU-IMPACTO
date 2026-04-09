import { NextResponse } from 'next/server'

// Consulta o status de uma NFS-e no provedor
export async function POST(req: Request) {
  try {
    const { unidade, provedorId, numero } = await req.json()

    if (!unidade?.provedor || (!provedorId && !numero)) {
      return NextResponse.json({ success: false, error: 'Dados insuficientes.' }, { status: 400 })
    }

    const provedor = unidade.provedor

    // ── NFE.io ──────────────────────────────────────────────────────────────────
    if (provedor === 'nfeio') {
      const companyId = unidade.companyId || unidade.cnpj.replace(/\D/g, '')
      const res = await fetch(`https://api.nfe.io/v2/companies/${companyId}/serviceinvoices/${provedorId}`, {
        headers: { 'Authorization': `Basic ${Buffer.from(`${unidade.apiKey}:`).toString('base64')}` }
      })
      const data = await res.json()
      return NextResponse.json({
        success: res.ok,
        status: data.flowStatus === 'Issued' ? 'emitida' : data.flowStatus === 'Error' ? 'erro' : 'processando',
        numero: data.number,
        chaveNFSe: data.checkCode,
        linkVisualizacao: data.viewerUrl,
        linkDownloadPdf: data.downloadUrl,
        erroDescricao: data.errors?.join('; '),
      })
    }

    // ── eNotas ──────────────────────────────────────────────────────────────────
    if (provedor === 'enotas') {
      const cnpj = unidade.cnpj.replace(/\D/g, '')
      const res = await fetch(`https://api.enotas.com.br/v2/Empresa/${cnpj}/Nfse/${provedorId}`, {
        headers: { 'Authorization': `Basic ${Buffer.from(`:${unidade.apiKey}`).toString('base64')}` }
      })
      const data = await res.json()
      return NextResponse.json({
        success: res.ok,
        status: data.status === 'Emitida' ? 'emitida' : data.status === 'Erro' ? 'erro' : 'processando',
        numero: data.numero,
        chaveNFSe: data.codigoVerificacao,
        linkVisualizacao: data.urlNfse,
        erroDescricao: data.mensagemErro,
      })
    }

    // ── Mock / fallback ──────────────────────────────────────────────────────────
    return NextResponse.json({ success: true, status: 'emitida', numero, message: 'Status consultado (mock).' })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
