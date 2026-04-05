/**
 * useCep — Hook para busca automática de endereço via ViaCEP
 * Endpoint: https://viacep.com.br/ws/{cep}/json/
 *
 * - Formata automaticamente: 00000-000
 * - Debounce 500ms
 * - AbortController para cancelar requests anteriores
 * - Fallback via CDN alternativo se viaCEP falhar
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface CepAddress {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string   // Cidade
  uf: string           // Estado (sigla)
  ibge: string
  erro?: boolean
}

export type CepStatus = 'idle' | 'loading' | 'success' | 'error' | 'invalid'

/** Remove tudo que não é dígito */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Aplica máscara: 00000-000 */
export function formatCep(value: string): string {
  const digits = onlyDigits(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

interface UseCepOptions {
  onSuccess?: (address: CepAddress) => void
  onError?: (msg: string) => void
}

interface UseCepReturn {
  address: CepAddress | null
  status: CepStatus
  statusMsg: string
  handleCepChange: (raw: string) => void
  cepValue: string
  reset: () => void
}

const DEBOUNCE_MS = 500

// Endpoints em ordem de prioridade (fallback)
const CEP_ENDPOINTS = [
  (cep: string) => `https://viacep.com.br/ws/${cep}/json/`,
  (cep: string) => `https://cdn.apicep.com/file/apicep/${cep.slice(0,5)}-${cep.slice(5)}.json`,
]

async function fetchCepData(digits: string, signal: AbortSignal): Promise<CepAddress | null> {
  const cep8 = digits.padEnd(8, '0').slice(0, 8)

  for (let i = 0; i < CEP_ENDPOINTS.length; i++) {
    const url = CEP_ENDPOINTS[i](cep8)
    try {
      const res = await fetch(url, { signal, mode: 'cors', cache: 'force-cache' })
      if (!res.ok) continue
      const data = await res.json()

      // viaCEP: { erro: true } quando não encontrado
      if (data.erro) return null

      // apicep: mapeamento diferente
      const normalized: CepAddress = {
        cep: data.cep ?? `${cep8.slice(0, 5)}-${cep8.slice(5)}`,
        logradouro: data.logradouro ?? data.address ?? '',
        complemento: data.complemento ?? '',
        bairro: data.bairro ?? data.district ?? '',
        localidade: data.localidade ?? data.city ?? '',
        uf: data.uf ?? data.state ?? '',
        ibge: data.ibge ?? '',
      }

      if (normalized.localidade && normalized.uf) return normalized
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err // propaga abort
      // ignora e tenta próximo endpoint
    }
  }
  return null
}

export function useCep(initialCep = '', options: UseCepOptions = {}): UseCepReturn {
  const [cepValue, setCepValue] = useState(() => formatCep(initialCep))
  const [address, setAddress] = useState<CepAddress | null>(null)
  const [status, setStatus] = useState<CepStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const fetchAddress = useCallback(async (digits: string) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setStatusMsg('Buscando endereço...')
    setAddress(null)

    try {
      const data = await fetchCepData(digits, controller.signal)
      if (data) {
        setStatus('success')
        setStatusMsg(`${data.localidade} – ${data.uf}`)
        setAddress(data)
        optionsRef.current.onSuccess?.(data)
      } else {
        setStatus('error')
        setStatusMsg('CEP não encontrado')
        optionsRef.current.onError?.('CEP não encontrado')
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setStatus('error')
      setStatusMsg('Erro ao buscar CEP. Verifique sua conexão.')
      optionsRef.current.onError?.('Erro de conexão')
    }
  }, [])

  const handleCepChange = useCallback((raw: string) => {
    const digits = onlyDigits(raw)
    // Limita a 8 dígitos antes de formatar
    const limited = digits.slice(0, 8)
    const formatted = formatCep(limited)
    setCepValue(formatted)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (limited.length === 0) {
      setStatus('idle')
      setStatusMsg('')
      setAddress(null)
      return
    }

    if (limited.length < 8) {
      setStatus('idle')
      setStatusMsg('')
      setAddress(null)
      return
    }

    // 8 dígitos — dispara busca com debounce
    debounceRef.current = setTimeout(() => {
      fetchAddress(limited)
    }, DEBOUNCE_MS)
  }, [fetchAddress])

  // Sincroniza com valor externo somente na montagem
  useEffect(() => {
    const digits = onlyDigits(initialCep)
    if (digits.length === 8) {
      setCepValue(formatCep(digits))
      fetchAddress(digits)
    } else if (digits.length > 0) {
      setCepValue(formatCep(digits))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = useCallback(() => {
    setCepValue('')
    setAddress(null)
    setStatus('idle')
    setStatusMsg('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  return { address, status, statusMsg, handleCepChange, cepValue, reset }
}
