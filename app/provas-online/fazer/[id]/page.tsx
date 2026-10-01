'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ExamRoom } from '@/components/provas-online/ExamRoom'
import { ProvaOnline, TentativaAluno } from '@/types/provas-online'
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useApp } from '@/lib/context'

export default function FazerProvaPage() {
  const params = useParams()
  const router = useRouter()
  const { currentUser } = useApp()
  const id = params?.id as string

  const [prova, setProva] = useState<ProvaOnline | null>(null)
  const [tentativa, setTentativa] = useState<TentativaAluno | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    async function loadData() {
      try {
        setLoading(true)
        // 1. Fetch exam definition
        const res = await fetch(`/api/provas-online/${id}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao carregar prova')
        }

        setProva(data.prova)

        // 2. Check if student already has an active attempt or submitted attempt
        if (data.myTentativa) {
          setTentativa(data.myTentativa)
        }
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar a avaliação')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold text-slate-700">Carregando sala de avaliação...</p>
      </div>
    )
  }

  if (error || !prova) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 flex flex-col items-center justify-center text-center">
        <div className="p-4 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mb-4">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Acesso Indisponível</h2>
        <p className="text-slate-500 max-w-md mb-6 text-sm">{error || 'A prova não foi encontrada ou não está aberta para realização.'}</p>
        <Link
          href="/provas-online"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors border border-slate-200 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Minhas Provas
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <ExamRoom
        prova={prova}
        initialTentativa={tentativa}
        currentUserId={currentUser?.id}
        alunoNome={currentUser?.nome || 'Aluno'}
      />
    </div>
  )
}
