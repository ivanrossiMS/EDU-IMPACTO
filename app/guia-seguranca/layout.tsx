import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://impacto-edu.net'),
  title: 'Guia de Segurança Digital — Colégio Impacto',
  description: 'Guia prático e interativo de Controle Parental, tempo de tela, redes sociais e proteção infantil no celular para famílias do Colégio Impacto.',
  keywords: ['Guia de Segurança Digital', 'Colégio Impacto', 'Controle Parental', 'Tempo de Tela', 'Family Link', 'iOS Tempo de Uso'],
  authors: [{ name: 'Colégio Impacto' }],
  openGraph: {
    title: 'Guia de Segurança Digital — Colégio Impacto',
    description: 'Guia prático e interativo de Controle Parental, tempo de tela, redes sociais e proteção infantil no celular para famílias do Colégio Impacto.',
    url: 'https://impacto-edu.net/guia-seguranca',
    siteName: 'Colégio Impacto',
    images: [
      {
        url: 'https://impacto-edu.net/logo-impacto.png',
        width: 800,
        height: 800,
        alt: 'Colégio Impacto — Logo Oficial',
      },
      {
        url: 'https://impacto-edu.net/guia-seguranca/family_digital_safety.jpg',
        width: 1200,
        height: 630,
        alt: 'Guia de Segurança Digital — Colégio Impacto',
      }
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guia de Segurança Digital — Colégio Impacto',
    description: 'Guia prático e interativo de Controle Parental, tempo de tela, redes sociais e proteção infantil no celular para famílias do Colégio Impacto.',
    images: ['https://impacto-edu.net/logo-impacto.png'],
  },
}

export default function GuiaSegurancaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
