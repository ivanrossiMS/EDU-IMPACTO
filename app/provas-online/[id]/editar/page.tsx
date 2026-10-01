'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ExamWizard } from '@/components/provas-online/ExamWizard'
import { ProvaOnline } from '@/types/provas-online'
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function EditarProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [prova, setProva] = useState<ProvaOnline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    async function loadProva() {
      try {
        setLoading(true)
        const res = await fetch(`/api/provas-online/${id}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao carregar prova para edição')
        }

        setProva(data.prova)
      } catch (err: any) {
        setError(err.message || 'Falha ao buscar dados da prova')
      } finally {
        setLoading(false)
      }
    }

    loadProva()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm">Carregando dados da avaliação...</p>
      </div>
    )
  }

  if (error || !prova) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 flex flex-col items-center justify-center text-center">
        <div className="p-4 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mb-4">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Prova não encontrada</h2>
        <p className="text-slate-500 max-w-md mb-6 text-sm">{error || 'A prova requisitada não existe ou você não possui permissão para editá-la.'}</p>
        <Link
          href="/provas-online"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Provas Online
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8">
      <ExamWizard initialExam={prova} isEditing={true} />
    </div>
  )
}
