'use client'
import { useEffect } from 'react'
import { Tablet, Monitor, History, Settings, ExternalLink } from 'lucide-react'

const ITEMS = [
  {
    icon: Tablet,   color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', bd: 'rgba(6,182,212,0.25)',
    title: 'Painel Tablet',
    desc: 'Controle de saída via RFID — abre em tela cheia sem sidebar',
    href: '/painel-tablet', newTab: true,
  },
  {
    icon: Monitor,  color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', bd: 'rgba(167,139,250,0.25)',
    title: 'Monitor TV',
    desc: 'Painel para TV da portaria com chamadas em tempo real',
    href: '/monitor-tv', newTab: true,
  },
  {
    icon: History,  color: '#10b981', bg: 'rgba(16,185,129,0.08)', bd: 'rgba(16,185,129,0.25)',
    title: 'Gestão de Chamadas',
    desc: 'Histórico, confirmações e controle de todas as chamadas',
    href: '/saida-alunos/chamadas', newTab: false,
  },
  {
    icon: Settings, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', bd: 'rgba(245,158,11,0.2)',
    title: 'Configurações',
    desc: 'Responsáveis, cartões RFID, voz e vínculos aluno-responsável',
    href: '/saida-alunos/configuracoes', newTab: false,
  },
]

export default function SaidaAlunosPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: 28, margin: '0 0 6px', letterSpacing: '-0.03em' }}>
          🚌 Controle de Saída de Alunos
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
          Sistema de portaria — selecione o módulo desejado
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {ITEMS.map(item => {
          const Icon = item.icon
          return (
            <a
              key={item.title}
              href={item.href}
              target={item.newTab ? '_blank' : '_self'}
              rel={item.newTab ? 'noopener noreferrer' : undefined}
              style={{
                background: 'hsl(var(--bg-elevated))',
                border: `1px solid ${item.bd}`,
                borderRadius: 20,
                padding: '24px',
                textDecoration: 'none',
                display: 'flex', flexDirection: 'column', gap: 16,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                boxShadow: `0 4px 20px ${item.color}08`,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.transform = 'translateY(-3px)'
                el.style.boxShadow = `0 12px 36px ${item.color}20`
                el.style.borderColor = item.color + '55'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = `0 4px 20px ${item.color}08`
                el.style.borderColor = item.bd
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: item.bg,
                  border: `1px solid ${item.bd}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={24} color={item.color}/>
                </div>
                {item.newTab && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                    <ExternalLink size={11}/>
                    Nova janela
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 17, color: 'hsl(var(--text-base))', marginBottom: 6 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
              <div style={{
                marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${item.bd}`,
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, color: item.color,
              }}>
                Abrir módulo
                <ExternalLink size={12}/>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
