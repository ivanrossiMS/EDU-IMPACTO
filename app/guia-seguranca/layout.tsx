import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guia de Segurança Digital para Pais e Responsáveis — Colégio Impacto',
  description: 'Guia prático e interativo de Controle Parental, tempo de tela, redes sociais e proteção infantil no celular para famílias do Colégio Impacto.',
  keywords: ['Segurança Digital', 'Controle Parental', 'Colégio Impacto', 'Tempo de Tela', 'Family Link', 'iOS Tempo de Uso'],
  openGraph: {
    title: 'Guia de Segurança Digital para Pais e Responsáveis — Colégio Impacto',
    description: 'Guia prático e interativo de Controle Parental, tempo de tela, redes sociais e proteção infantil no celular para famílias do Colégio Impacto.',
    url: 'https://impacto-edu.net/guia-seguranca',
    siteName: 'Colégio Impacto',
    images: [
      {
        url: 'https://impacto-edu.net/guia-seguranca/family_digital_safety.jpg',
        width: 1200,
        height: 630,
        alt: 'Guia de Segurança Digital — Colégio Impacto',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guia de Segurança Digital para Pais e Responsáveis — Colégio Impacto',
    description: 'Guia prático e interativo de Controle Parental, tempo de tela, redes sociais e proteção infantil no celular para famílias do Colégio Impacto.',
    images: ['https://impacto-edu.net/guia-seguranca/family_digital_safety.jpg'],
  },
}

export default function GuiaSegurancaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
