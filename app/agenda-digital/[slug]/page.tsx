'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { LoadingGlass } from '@/components/LoadingGlass'

export default function GenericSlugPage({ params }: { params: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = useParams() as { slug: string }

  useEffect(() => {
    // Trata deep links como /agenda-digital/comunicados vs rotas diretas de aluno /agenda-digital/4697
    if (resolvedParams?.slug) {
      const slug = String(resolvedParams.slug).toLowerCase().trim()
      const sp = new URLSearchParams(searchParams?.toString() || '')
      const KNOWN_MODULES = [
        'comunicados',
        'frequencia',
        'notas',
        'financeiro',
        'ocorrencias',
        'momentos',
        'calendario',
        'perfil',
        'admin',
        'colaborador',
        'selecionar-aluno'
      ]

      if (KNOWN_MODULES.includes(slug)) {
        sp.set('redirect', slug)
        router.replace(`/agenda-digital?${sp.toString()}`)
      } else {
        // É um ID de aluno (ex: /agenda-digital/4697)
        const targetModule = sp.get('tab') || sp.get('redirect') || 'comunicados'
        const queryStr = sp.toString() ? `?${sp.toString()}` : ''
        router.replace(`/agenda-digital/${resolvedParams.slug}/${targetModule}${queryStr}`)
      }
    }
  }, [resolvedParams, router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <LoadingGlass />
    </div>
  )
}
