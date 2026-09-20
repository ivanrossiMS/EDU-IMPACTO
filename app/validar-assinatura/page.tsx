import { Metadata } from 'next'
import { ValidarAssinaturaClient } from './ValidarAssinaturaClient'

export const metadata: Metadata = {
  title: 'Validação de Autenticidade de Documentos | Colégio Impacto',
  description: 'Consulte a autenticidade e validade jurídica de contratos e documentos assinados eletronicamente no Sistema Impacto EDU.',
}

export default function ValidarAssinaturaPage() {
  return <ValidarAssinaturaClient />
}
