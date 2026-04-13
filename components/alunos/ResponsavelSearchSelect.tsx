'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { User, Search, Plus, X, CheckCircle, AlertCircle, Phone, Mail, Loader2 } from 'lucide-react'

export interface ResponsavelOption {
  id: string
  nome: string
  cpf?: string | null
  telefone?: string | null
  celular?: string | null
  email?: string | null
  parentesco?: string | null
  dados?: Record<string, any>
}

interface Props {
  label: string
  placeholder?: string
  value?: ResponsavelOption | null
  onChange: (resp: ResponsavelOption | null) => void
  onCreateNew?: () => void // abre modal de criação
  disabled?: boolean
  className?: string
  required?: boolean
  tipoHint?: 'mae' | 'pai' | 'financeiro' | 'pedagogico' | 'outro'
}

export function ResponsavelSearchSelect({
  label,
  placeholder = 'Buscar responsável por nome ou CPF...',
  value,
  onChange,
  onCreateNew,
  disabled = false,
  className = '',
  required = false,
  tipoHint,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResponsavelOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cpfWarn, setCpfWarn] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscarResponsaveis = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    setLoading(true)
    try {
      const resp = await fetch(`/api/responsaveis?q=${encodeURIComponent(q)}&limit=10`)
      const json = await resp.json()
      const lista = Array.isArray(json) ? json : (json.data ?? [])
      setResults(lista)
      setIsOpen(lista.length > 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const verificarCPF = useCallback(async (cpf: string) => {
    const cpfLimpo = cpf.replace(/\D/g, '')
    if (cpfLimpo.length < 11) return
    const resp = await fetch(`/api/responsaveis?cpf=${cpfLimpo}`)
    const json = await resp.json()
    const lista = Array.isArray(json) ? json : (json.data ?? [])
    if (lista.length > 0) {
      const found = lista[0] as ResponsavelOption
      setCpfWarn(`CPF já cadastrado para: "${found.nome}". Selecione abaixo para vincular.`)
      setResults(lista)
      setIsOpen(true)
    } else {
      setCpfWarn(null)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setCpfWarn(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Se parece CPF, verifica anti-duplicidade
    const possibleCpf = val.replace(/\D/g, '')
    if (possibleCpf.length >= 11) {
      debounceRef.current = setTimeout(() => verificarCPF(val), 500)
    } else {
      debounceRef.current = setTimeout(() => buscarResponsaveis(val), 300)
    }
  }

  const handleSelect = (resp: ResponsavelOption) => {
    onChange(resp)
    setQuery(resp.nome)
    setIsOpen(false)
    setCpfWarn(null)
    setResults([])
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setCpfWarn(null)
    setResults([])
    setIsOpen(false)
  }

  const fmtCpf = (cpf?: string | null) => {
    if (!cpf) return null
    const c = cpf.replace(/\D/g, '')
    if (c.length !== 11) return cpf
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
  }

  const tipoColor: Record<string, string> = {
    mae: '#e91e8c',
    pai: '#1e88e5',
    financeiro: '#43a047',
    pedagogico: '#fb8c00',
    outro: '#757575',
  }

  const borderColor = tipoHint ? tipoColor[tipoHint] || '#4f46e5' : '#4f46e5'

  return (
    <div ref={containerRef} className={`resp-search-wrap ${className}`} style={{ position: 'relative' }}>
      <label className="resp-search-label">
        {label}
        {required && <span style={{ color: '#e53e3e', marginLeft: 2 }}>*</span>}
      </label>

      {/* Campo de busca / selecionado */}
      <div className="resp-search-field" style={{ borderColor: value ? borderColor : undefined }}>
        <span className="resp-search-icon">
          {loading ? (
            <Loader2 size={16} className="spin" />
          ) : value ? (
            <CheckCircle size={16} style={{ color: borderColor }} />
          ) : (
            <Search size={16} />
          )}
        </span>

        {value ? (
          // Estado: responsável selecionado
          <div className="resp-selected-info" onClick={handleClear} style={{ cursor: 'pointer', flex: 1 }}>
            <div className="resp-selected-name" style={{ color: borderColor }}>{value.nome}</div>
            <div className="resp-selected-sub">
              {value.cpf && <span>{fmtCpf(value.cpf)}</span>}
              {value.telefone && <span><Phone size={10} /> {value.telefone}</span>}
              {value.email && <span><Mail size={10} /> {value.email}</span>}
            </div>
          </div>
        ) : (
          // Estado: digitando
          <input
            type="text"
            className="resp-search-input"
            value={query}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
          />
        )}

        {(value || query) && (
          <button
            type="button"
            className="resp-clear-btn"
            onClick={handleClear}
            title="Remover"
            disabled={disabled}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Aviso de CPF duplicado */}
      {cpfWarn && (
        <div className="resp-cpf-warn">
          <AlertCircle size={13} />
          <span>{cpfWarn}</span>
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && results.length > 0 && (
        <div className="resp-dropdown">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              className="resp-dropdown-item"
              onClick={() => handleSelect(r)}
            >
              <div className="resp-dropdown-avatar">
                <User size={14} />
              </div>
              <div className="resp-dropdown-info">
                <div className="resp-dropdown-name">{r.nome}</div>
                <div className="resp-dropdown-sub">
                  {r.cpf && <span>{fmtCpf(r.cpf)}</span>}
                  {(r.telefone || r.celular) && <span>{r.telefone || r.celular}</span>}
                </div>
              </div>
            </button>
          ))}

          {/* Criar novo */}
          {onCreateNew && (
            <button
              type="button"
              className="resp-dropdown-create"
              onClick={() => {
                setIsOpen(false)
                onCreateNew()
              }}
            >
              <Plus size={14} />
              <span>Criar novo responsável{query ? ` "${query}"` : ''}</span>
            </button>
          )}
        </div>
      )}

      {/* "Criar novo" quando não há resultados */}
      {isOpen && results.length === 0 && !loading && query.length >= 2 && onCreateNew && (
        <div className="resp-dropdown">
          <div className="resp-dropdown-empty">Nenhum responsável encontrado para "{query}"</div>
          <button
            type="button"
            className="resp-dropdown-create"
            onClick={() => {
              setIsOpen(false)
              onCreateNew()
            }}
          >
            <Plus size={14} />
            <span>Criar novo responsável "{query}"</span>
          </button>
        </div>
      )}

      {/* Botão criar quando campo vazio */}
      {!value && !isOpen && onCreateNew && (
        <button
          type="button"
          className="resp-create-standalone"
          onClick={onCreateNew}
          disabled={disabled}
        >
          <Plus size={12} />
          Criar novo responsável
        </button>
      )}

      <style>{`
        .resp-search-wrap { display: flex; flex-direction: column; gap: 4px; }
        .resp-search-label { font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; }
        .resp-search-field {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.05); border: 1.5px solid rgba(148,163,184,0.2);
          border-radius: 10px; padding: 10px 12px; transition: border-color 0.2s;
        }
        .resp-search-field:focus-within { border-color: #4f46e5; }
        .resp-search-icon { color: #64748b; display: flex; align-items: center; flex-shrink: 0; }
        .resp-search-input {
          flex: 1; background: none; border: none; outline: none;
          color: #f1f5f9; font-size: 14px;
        }
        .resp-search-input::placeholder { color: #475569; }
        .resp-selected-info { flex: 1; min-width: 0; }
        .resp-selected-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .resp-selected-sub { display: flex; gap: 8px; font-size: 11px; color: #64748b; margin-top: 1px; flex-wrap: wrap; align-items: center; }
        .resp-selected-sub span { display: flex; align-items: center; gap: 3px; }
        .resp-clear-btn { background: none; border: none; cursor: pointer; color: #64748b; display: flex; align-items: center; padding: 2px; border-radius: 4px; }
        .resp-clear-btn:hover { color: #e53e3e; background: rgba(229,62,62,0.1); }
        .resp-cpf-warn {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: #f59e0b; background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; padding: 5px 8px;
        }
        .resp-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 9999;
          background: #1e293b; border: 1px solid rgba(148,163,184,0.2);
          border-radius: 10px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          max-height: 280px; overflow-y: auto;
        }
        .resp-dropdown-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left; background: none; border: none;
          padding: 10px 12px; cursor: pointer; color: #f1f5f9; transition: background 0.15s;
        }
        .resp-dropdown-item:hover { background: rgba(79,70,229,0.15); }
        .resp-dropdown-avatar {
          width: 30px; height: 30px; border-radius: 50%; background: rgba(79,70,229,0.2);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #818cf8;
        }
        .resp-dropdown-info { flex: 1; min-width: 0; }
        .resp-dropdown-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .resp-dropdown-sub { display: flex; gap: 8px; font-size: 11px; color: #64748b; }
        .resp-dropdown-empty { padding: 12px; font-size: 12px; color: #64748b; text-align: center; }
        .resp-dropdown-create {
          display: flex; align-items: center; gap: 6px;
          width: 100%; background: rgba(79,70,229,0.1); border: none; border-top: 1px solid rgba(148,163,184,0.1);
          padding: 10px 12px; cursor: pointer; color: #818cf8; font-size: 13px; font-weight: 500;
          transition: background 0.15s;
        }
        .resp-dropdown-create:hover { background: rgba(79,70,229,0.25); }
        .resp-create-standalone {
          display: flex; align-items: center; gap: 5px;
          background: none; border: 1px dashed rgba(79,70,229,0.4);
          color: #818cf8; font-size: 11px; border-radius: 6px; padding: 5px 10px;
          cursor: pointer; transition: all 0.15s; margin-top: 2px;
        }
        .resp-create-standalone:hover { background: rgba(79,70,229,0.1); border-color: #818cf8; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
