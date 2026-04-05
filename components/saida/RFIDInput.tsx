'use client'
import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Wifi } from 'lucide-react'

interface RFIDInputProps {
  onRead: (code: string) => void
  enabled?: boolean
}

export interface RFIDInputHandle {
  clear: () => void
}

export const RFIDInput = forwardRef<RFIDInputHandle, RFIDInputProps>(
  function RFIDInput({ onRead, enabled = true }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const bufferRef = useRef('')
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [pulse, setPulse] = useState(false)

    // Expose clear() so parent can wipe buffer after reset
    useImperativeHandle(ref, () => ({
      clear: () => {
        bufferRef.current = ''
        if (timerRef.current) clearTimeout(timerRef.current)
        if (inputRef.current) inputRef.current.value = ''
      },
    }))

    // Keep focus on input
    useEffect(() => {
      if (!enabled) return
      const refocus = () => {
        if (document.activeElement !== inputRef.current) inputRef.current?.focus()
      }
      document.addEventListener('click', refocus)
      inputRef.current?.focus()
      return () => document.removeEventListener('click', refocus)
    }, [enabled])

    // Clear buffer & DOM value when disabled (mode changed away from idle/rfid)
    useEffect(() => {
      if (!enabled) {
        bufferRef.current = ''
        if (timerRef.current) clearTimeout(timerRef.current)
        if (inputRef.current) inputRef.current.value = ''
      }
    }, [enabled])

    const flush = useCallback(() => {
      const code = bufferRef.current.trim()
      bufferRef.current = ''
      if (inputRef.current) inputRef.current.value = ''
      if (code.length >= 4) {
        setPulse(true)
        setTimeout(() => setPulse(false), 600)
        onRead(code)
      }
    }, [onRead])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (timerRef.current) clearTimeout(timerRef.current)
        flush()
        return
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, 80)
    }, [flush])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      bufferRef.current = e.target.value
    }, [])

    if (!enabled) return null

    return (
      <div style={{ position: 'relative' }}>
        {/* Invisible input that captures RFID keystrokes */}
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          style={{
            position: 'absolute', opacity: 0, width: 1, height: 1,
            pointerEvents: 'none', top: 0, left: 0,
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          tabIndex={-1}
          aria-label="Captura RFID"
        />
        {/* Visual indicator */}
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 100,
          background: pulse ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.08)',
          border: `1px solid ${pulse ? 'rgba(16,185,129,0.4)' : 'rgba(6,182,212,0.2)'}`,
          fontSize: 11, fontWeight: 700, color: pulse ? '#10b981' : '#06b6d4',
          transition: 'all 0.2s', zIndex: 100,
        }}>
          <Wifi size={12} style={{ animation: pulse ? 'none' : 'spin 3s linear infinite' }}/>
          {pulse ? 'RFID lido!' : 'RFID ativo'}
        </div>
      </div>
    )
  }
)
