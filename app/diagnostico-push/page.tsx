'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Bell, Smartphone, Shield, ExternalLink, HelpCircle } from 'lucide-react'
import { DevicePushDiagnosticCard } from '@/components/notifications/DevicePushDiagnosticCard'

export default function DiagnosticoPushPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Diagnóstico ao Vivo
          </div>
        </div>

        {/* Main Card */}
        <DevicePushDiagnosticCard
          title="Auditoria & Diagnóstico do Aparelho (OneSignal / iOS)"
          description="Consulte e interaja diretamente com o SDK nativo OneSignal e os subsistemas do iOS sem intermediários."
        />

        {/* Guia de Orientação para o Painel OneSignal */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 text-xs text-slate-300 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <HelpCircle className="h-4 w-4 text-indigo-400" />
            Como Localizar Este Aparelho Exato no Painel do OneSignal:
          </div>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
            <li>
              Acesse o painel do <strong>OneSignal Dashboard</strong> &gt; Selecione o app <strong>Impacto Edu</strong>.
            </li>
            <li>
              No menu lateral esquerdo, vá em <strong>Audience</strong> &gt; <strong>Subscriptions</strong> (ou <strong>Users</strong>).
            </li>
            <li>
              <strong>NÃO identifique o aparelho apenas pelo nome do modelo</strong> (ex: iPhone). Ao desinstalar e reinstalar o app, a Apple e o OneSignal criam um <strong>NOVO Subscription ID</strong>, e o registro antigo fica abandonado no painel para sempre como <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">Never Subscribed</code>.
            </li>
            <li>
              Utilize o campo de busca no painel do OneSignal e cole o <strong>Subscription ID</strong> copiado do card acima.
            </li>
            <li>
              Verifique se a coluna <strong>Subscription ID</strong> coincide exatamente caractere por caractere com o ID deste aparelho.
            </li>
            <li>
              Caso o status esteja <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">Never Prompted</code>, toque no botão <strong>Solicitar Permissão SO</strong> acima para acionar o prompt nativo da Apple.
            </li>
            <li>
              Caso esteja <code className="text-rose-400 bg-slate-800 px-1 py-0.5 rounded">Denied</code>, toque no botão <strong>Abrir Ajustes do iPhone</strong> e ative as notificações.
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-400">
          Impacto Edu &bull; Agenda Digital &bull; Diagnóstico de Push Notifications &bull; Capacitor Native Bridge
        </div>
      </div>
    </div>
  )
}
