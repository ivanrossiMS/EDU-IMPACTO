'use client'

/**
 * CepInput / CepAddressFields
 *
 * ARQUITETURA FINAL:
 * - CepAddressFields gerencia seu próprio estado de CEP internamente
 * - Quando a API responde, preenche campos via onChange() de forma direta
 * - Não depende de callbacks ou efeitos colaterais com closures stale
 * - O campo CEP é "controlado pelo componente" (não pelo pai):
 *   o pai só recebe updates via onChange, mas a exibição é interna
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, CheckCircle2, AlertCircle, MapPin } from 'lucide-react'
import { formatCep } from '@/lib/useCep'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AddressFields {
  cep: string
  logradouro: string
  numero?: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
}

export type { CepAddress } from '@/lib/useCep'

type CepStatus = 'idle' | 'loading' | 'success' | 'error'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5, 8)}`
}

async function viaCep(digits8: string) {
  const res = await fetch(`https://viacep.com.br/ws/${digits8}/json/`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('http_error')
  const data = await res.json()
  if (data.erro) return null
  return data as {
    logradouro: string; complemento: string; bairro: string
    localidade: string; uf: string; cep: string
  }
}

function StatusIcon({ status }: { status: CepStatus }) {
  if (status === 'loading') return <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#60a5fa' }} />
  if (status === 'success') return <CheckCircle2 size={14} color="#10b981" />
  if (status === 'error')   return <AlertCircle size={14} color="#ef4444" />
  return <MapPin size={14} style={{ color: 'hsl(var(--text-muted))' }} />
}

// ─── CepInputRaw — input com máscara (sem busca) ──────────────────────────────

interface CepInputRawProps {
  value: string
  onChange: (formatted: string) => void
  status?: CepStatus
  disabled?: boolean
}

function CepInputRaw({ value, onChange, status = 'idle', disabled }: CepInputRawProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => onChange(maskCep(e.target.value))
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    onChange(maskCep(e.clipboardData.getData('text')))
  }
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
        <StatusIcon status={status} />
      </div>
      <input
        className="form-input"
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder="00000-000"
        maxLength={9}
        inputMode="numeric"
        autoComplete="postal-code"
        disabled={disabled}
        style={{
          paddingLeft: 34,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          borderColor: status === 'success' ? 'rgba(16,185,129,0.5)' : status === 'error' ? 'rgba(239,68,68,0.5)' : undefined,
          transition: 'border-color 0.2s',
        }}
      />
    </div>
  )
}

// ─── CepInput — componente público standalone ────────────────────────────────

import type { CepAddress } from '@/lib/useCep'

interface CepInputProps {
  value: string
  onCepChange: (formatted: string) => void
  onAddressFound?: (address: CepAddress) => void
  onError?: (msg: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  label?: string
}

export function CepInput({
  value,
  onCepChange,
  onAddressFound,
  onError,
  disabled,
  label = 'CEP',
}: CepInputProps) {
  const [cepVal, setCepVal] = useState(maskCep(value))
  const [status, setStatus] = useState<CepStatus>('idle')
  const [msg, setMsg] = useState('')
  const [foundAddr, setFoundAddr] = useState<CepAddress | null>(null)
  const debounce = useRef<NodeJS.Timeout | null>(null)
  const onSuccessRef = useRef(onAddressFound)
  const onErrorRef = useRef(onError)
  onSuccessRef.current = onAddressFound
  onErrorRef.current = onError

  const doSearch = useCallback((digits: string) => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setStatus('loading'); setMsg('Buscando endereço...'); setFoundAddr(null)
      try {
        const data = await viaCep(digits)
        if (data) {
          setStatus('success')
          setMsg(`${data.localidade} – ${data.uf}`)
          setFoundAddr(data as unknown as CepAddress)
          onSuccessRef.current?.(data as unknown as CepAddress)
        } else {
          setStatus('error'); setMsg('CEP não encontrado')
          onErrorRef.current?.('CEP não encontrado')
        }
      } catch {
        setStatus('error'); setMsg('Erro ao buscar CEP')
        onErrorRef.current?.('Erro de conexão')
      }
    }, 500)
  }, [])

  const handleChange = (formatted: string) => {
    setCepVal(formatted)
    onCepChange(formatted)
    const digits = formatted.replace(/\D/g, '')
    if (digits.length === 8) doSearch(digits)
    else { setStatus('idle'); setMsg(''); setFoundAddr(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label className="form-label">{label}</label>}
      <CepInputRaw value={cepVal} onChange={handleChange} status={status} disabled={disabled} />
      {msg && (
        <div style={{ fontSize: 11, color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'hsl(var(--text-muted))' }}>
          {status === 'loading' ? '⟳ Buscando...' : status === 'success' ? `✓ ${msg}` : `⚠ ${msg}`}
        </div>
      )}
      {status === 'success' && foundAddr?.logradouro && (
        <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, fontSize: 11, color: '#10b981', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700 }}>📍 {foundAddr.logradouro}</div>
          <div>{foundAddr.bairro} — {foundAddr.localidade}/{foundAddr.uf}</div>
        </div>
      )}
    </div>
  )
}

// ─── CepAddressFields ─────────────────────────────────────────────────────────

interface CepAddressFieldsProps extends AddressFields {
  onChange: (field: keyof AddressFields, value: string) => void
  disabled?: boolean
  showNumero?: boolean
  showComplemento?: boolean
}

export function CepAddressFields({
  cep, logradouro, numero = '', complemento = '', bairro, cidade, estado,
  onChange, disabled, showNumero = true, showComplemento = true,
}: CepAddressFieldsProps) {

  // Estado interno do CEP — independente do pai para evitar re-mount
  const [cepInterno, setCepInterno] = useState(maskCep(cep))
  const [status, setStatus] = useState<CepStatus>('idle')
  const [msg, setMsg] = useState('')
  const debounce = useRef<NodeJS.Timeout | null>(null)

  // onChangeRef — sempre atualizado, nunca stale
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const doSearch = useCallback((digits: string) => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setStatus('loading'); setMsg('Buscando endereço...')
      try {
        const data = await viaCep(digits)
        if (data) {
          setStatus('success')
          setMsg(`${data.localidade} – ${data.uf}`)

          // ── PREENCHE OS CAMPOS DIRETAMENTE ──────────────────────────
          // Chama onChangeRef.current (sempre a versão mais atual)
          // para cada campo retornado pela API
          const cb = onChangeRef.current
          if (data.logradouro) cb('logradouro', data.logradouro)
          if (data.bairro)     cb('bairro',     data.bairro)
          if (data.localidade) cb('cidade',      data.localidade)
          if (data.uf)         cb('estado',      data.uf)
          // Atualiza CEP com formato correto
          const cepFmt = formatCep(data.cep || digits)
          setCepInterno(cepFmt)
          cb('cep', cepFmt)
        } else {
          setStatus('error'); setMsg('CEP não encontrado')
        }
      } catch {
        setStatus('error'); setMsg('Erro ao buscar CEP')
      }
    }, 500)
  }, [])

  // Limpa debounce no unmount
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current) }, [])

  const handleCepChange = (formatted: string) => {
    setCepInterno(formatted)
    onChange('cep', formatted)
    const digits = formatted.replace(/\D/g, '')
    if (digits.length === 8) {
      doSearch(digits)
    } else {
      setStatus('idle'); setMsg('')
    }
  }

  const filled = status === 'success'

  const autoStyle = (hasValue: boolean): React.CSSProperties => ({
    background: filled && hasValue ? 'rgba(16,185,129,0.04)' : undefined,
    borderColor: filled && hasValue ? 'rgba(16,185,129,0.3)' : undefined,
    transition: 'all 0.25s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Linha 1: CEP + Logradouro */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label className="form-label">CEP</label>
          <CepInputRaw value={cepInterno} onChange={handleCepChange} status={status} disabled={disabled} />
          {msg && (
            <div style={{ fontSize: 11, color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'hsl(var(--text-muted))' }}>
              {status === 'loading' ? '⟳ Buscando...' : status === 'success' ? `✓ ${msg}` : `⚠ ${msg}`}
            </div>
          )}
        </div>

        <div>
          <label className="form-label">Logradouro (Rua/Av.)</label>
          <input
            className="form-input"
            value={logradouro}
            onChange={e => onChange('logradouro', e.target.value)}
            placeholder="Preenchido automaticamente pelo CEP"
            disabled={disabled}
            style={autoStyle(!!logradouro)}
          />
        </div>
      </div>

      {/* Linha 2: Número + Complemento */}
      {(showNumero || showComplemento) && (
        <div style={{ display: 'grid', gridTemplateColumns: showNumero && showComplemento ? '120px 1fr' : '1fr', gap: 12 }}>
          {showNumero && (
            <div>
              <label className="form-label">Número</label>
              <input className="form-input" value={numero} onChange={e => onChange('numero', e.target.value)} placeholder="Nº" disabled={disabled} />
            </div>
          )}
          {showComplemento && (
            <div>
              <label className="form-label">Complemento</label>
              <input className="form-input" value={complemento} onChange={e => onChange('complemento', e.target.value)} placeholder="Apto, sala, bloco..." disabled={disabled} />
            </div>
          )}
        </div>
      )}

      {/* Linha 3: Bairro + Cidade + UF */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 12 }}>
        <div>
          <label className="form-label">Bairro</label>
          <input className="form-input" value={bairro} onChange={e => onChange('bairro', e.target.value)}
            placeholder="Preenchido automaticamente" disabled={disabled} style={autoStyle(!!bairro)} />
        </div>
        <div>
          <label className="form-label">Cidade</label>
          <input className="form-input" value={cidade} onChange={e => onChange('cidade', e.target.value)}
            placeholder="Preenchido automaticamente" disabled={disabled} style={autoStyle(!!cidade)} />
        </div>
        <div>
          <label className="form-label">UF</label>
          <input className="form-input" value={estado} onChange={e => onChange('estado', e.target.value)}
            placeholder="SP" maxLength={2} disabled={disabled}
            style={{ ...autoStyle(!!estado), textTransform: 'uppercase' }} />
        </div>
      </div>

    </div>
  )
}
