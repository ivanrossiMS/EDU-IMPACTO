'use client'

import React from 'react'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  BookOpen,
  Calendar,
  ChevronDown,
  FileSignature,
  FolderArchive,
  LayoutDashboard,
  Library,
  PenTool,
  Plus,
  Search,
  X,
} from 'lucide-react'

interface BimestreOption {
  id: string
  nome: string
}

interface SimuladosHeaderProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  bimestreFilter: string
  onBimestreChange: (value: string) => void
  bimestres: BimestreOption[]
  totalCount: number
  reviewCount: number
}

const CREATE_OPTIONS = [
  {
    label: 'Nova Prova',
    description: 'Avaliação bimestral por disciplina',
    href: '/simulados/provas-upload/nova',
    icon: FileSignature,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
  },
  {
    label: 'Novo Simulado',
    description: 'Caderno multidisciplinar integrado',
    href: '/simulados/simulados-upload/nova',
    icon: BookOpen,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.12)',
  },
  {
    label: 'Nova Redação',
    description: 'Proposta temática com critérios',
    href: '/simulados/redacao-upload/nova',
    icon: PenTool,
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.12)',
  },
] as const

const SECONDARY_CREATE_OPTIONS = [
  {
    label: 'Arquivo de Prova Adaptada',
    href: '/simulados/arquivo-adaptadas/nova',
    icon: FolderArchive,
    color: '#f59e0b',
  },
  {
    label: 'Questão no Banco',
    href: '/simulados/banco/nova',
    icon: Library,
    color: '#8b5cf6',
  },
] as const

export function SimuladosHeader({
  searchQuery,
  onSearchChange,
  searchInputRef,
  bimestreFilter,
  onBimestreChange,
  bimestres,
  totalCount,
  reviewCount,
}: SimuladosHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Left: Breadcrumb + Title + Operational Summary */}
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[hsl(var(--text-muted))]">
          <span className="inline-flex items-center gap-1.5 text-[#f43f5e]">
            <LayoutDashboard size={13} />
            Provas & Simulados
          </span>
          <span aria-hidden="true">/</span>
          <span>Painel de Controle</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-[hsl(var(--text-primary))] sm:text-[28px]">
            Painel de Controle
          </h1>

          {reviewCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {reviewCount} {reviewCount === 1 ? 'pronta p/ revisão' : 'prontas p/ revisão'}
            </span>
          )}
        </div>

        <p className="m-0 text-sm text-[hsl(var(--text-secondary))]">
          {totalCount > 0
            ? `${totalCount} avaliações monitoradas no ciclo atual — acompanhe envios, prazos e aprovações.`
            : 'Visão geral de Provas, Simulados e Redações.'}
        </p>
      </div>

      {/* Right: Search + Bimestre Filter + Unified Create CTA */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Instant Search */}
        <div className="sim-input-wrap h-10 min-w-[220px] flex-1 px-3 sm:w-64 sm:flex-initial">
          <Search size={15} className="shrink-0 text-[hsl(var(--text-muted))]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar avaliação, série, prof..."
            aria-label="Buscar avaliações"
            className="sim-clean-input w-full text-xs font-medium sm:text-[13px]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpar busca"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[hsl(var(--text-muted))] transition-colors hover:bg-slate-200/70 hover:text-[hsl(var(--text-primary))] dark:hover:bg-slate-700"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded border border-[hsl(var(--border-subtle))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--text-muted))] sm:inline-block">
              /
            </kbd>
          )}
        </div>

        {/* Bimestre Filter */}
        {bimestres.length > 0 && (
          <div className="sim-input-wrap h-10 px-2.5">
            <Calendar size={14} className="shrink-0 text-[hsl(var(--text-muted))]" />
            <select
              value={bimestreFilter}
              onChange={(e) => onBimestreChange(e.target.value)}
              aria-label="Filtrar por bimestre"
              className="sim-clean-select cursor-pointer pr-1 text-xs font-semibold"
            >
              <option value="todos">Todos os bimestres</option>
              {bimestres.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Unified Primary CTA Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#f43f5e] to-[#e11d48] px-4 text-[13px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(244,63,94,0.45)] transition-all hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f43f5e]"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Nova Avaliação</span>
              <ChevronDown size={14} className="opacity-85" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-[1200] w-72 rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface))] p-2 shadow-xl backdrop-blur-xl"
            >
              <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-[hsl(var(--text-muted))] uppercase">
                Criar via Upload
              </div>

              {CREATE_OPTIONS.map((opt) => (
                <DropdownMenu.Item key={opt.href} asChild>
                  <Link
                    href={opt.href}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 no-underline outline-none transition-colors hover:bg-[hsl(var(--bg-elevated))] focus:bg-[hsl(var(--bg-elevated))]"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: opt.bg, color: opt.color }}
                    >
                      <opt.icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-[hsl(var(--text-primary))]">
                        {opt.label}
                      </span>
                      <span className="block truncate text-[11px] text-[hsl(var(--text-secondary))]">
                        {opt.description}
                      </span>
                    </span>
                  </Link>
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="my-1.5 h-px bg-[hsl(var(--border-subtle))]" />

              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-[hsl(var(--text-muted))] uppercase">
                Outros Fluxos
              </div>

              {SECONDARY_CREATE_OPTIONS.map((opt) => (
                <DropdownMenu.Item key={opt.href} asChild>
                  <Link
                    href={opt.href}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[hsl(var(--text-primary))] no-underline outline-none transition-colors hover:bg-[hsl(var(--bg-elevated))] focus:bg-[hsl(var(--bg-elevated))]"
                  >
                    <opt.icon size={15} style={{ color: opt.color }} />
                    <span>{opt.label}</span>
                  </Link>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
