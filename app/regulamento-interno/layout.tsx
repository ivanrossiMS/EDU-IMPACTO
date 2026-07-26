import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Regulamento Interno de Trabalho — Colégio Impacto',
  description: 'Normas gerais de organização, conduta, segurança e convivência aplicáveis aos colaboradores e empregados do Colégio Impacto.',
  openGraph: {
    title: 'Regulamento Interno de Trabalho — Colégio Impacto',
    description: 'Normas gerais de organização, conduta, segurança e convivência aplicáveis aos colaboradores e empregados do Colégio Impacto.',
    url: 'https://impacto-edu.net/regulamento-interno',
    siteName: 'Colégio Impacto',
    images: [
      {
        url: 'https://impacto-edu.net/logo-impacto.png',
        width: 512,
        height: 512,
        alt: 'Logo Colégio Impacto',
        type: 'image/png',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Regulamento Interno de Trabalho — Colégio Impacto',
    description: 'Normas gerais de organização, conduta, segurança e convivência aplicáveis aos colaboradores e empregados do Colégio Impacto.',
    images: ['https://impacto-edu.net/logo-impacto.png'],
  },
}

export default function RegulamentoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

