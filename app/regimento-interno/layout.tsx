import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Regimento Escolar Interno — Colégio Impacto',
  description: 'Instrumento jurídico-educacional que regulamenta a organização administrativa, didático-pedagógica e disciplinar do Colégio.',
  openGraph: {
    title: 'Regimento Escolar Interno — Colégio Impacto',
    description: 'Instrumento jurídico-educacional que regulamenta a organização administrativa, didático-pedagógica e disciplinar do Colégio.',
    url: 'https://impacto-edu.net/regimento-interno',
    siteName: 'Colégio Impacto',
    images: [
      {
        url: 'https://colegioimpacto.net/wp-content/uploads/2021/04/cropped-logo-colegio-impacto-1.png',
        width: 512,
        height: 512,
        alt: 'Logo Colégio Impacto',
      }
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Regimento Escolar Interno — Colégio Impacto',
    description: 'Instrumento jurídico-educacional que regulamenta a organização administrativa, didático-pedagógica e disciplinar do Colégio.',
    images: ['https://colegioimpacto.net/wp-content/uploads/2021/04/cropped-logo-colegio-impacto-1.png'],
  }
}

export default function RegimentoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
