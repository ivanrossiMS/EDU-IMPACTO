'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export interface VoiceOptions {
  rate?: number    // 0.1 – 2.0 (default 1.0)
  pitch?: number   // 0 – 2 (default 1.0)
  volume?: number  // 0 – 1 (default 1.0)
  voiceURI?: string
  repeatCount?: number
}

export interface UseVoiceReturn {
  speak: (text: string, opts?: VoiceOptions) => void
  cancel: () => void
  isSpeaking: boolean
  isSupported: boolean
  voices: SpeechSynthesisVoice[]
}

// Queue entry
interface QueueItem {
  text: string
  opts: VoiceOptions
}

export function useVoice(defaultOpts: VoiceOptions = {}): UseVoiceReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const queue = useRef<QueueItem[]>([])
  const processing = useRef(false)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Load voices (async on Chrome)
  useEffect(() => {
    if (!isSupported) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [isSupported])

  const processQueue = useCallback(() => {
    if (!isSupported || processing.current || queue.current.length === 0) return
    processing.current = true
    const item = queue.current.shift()!
    const merged = { ...defaultOpts, ...item.opts }

    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.rate   = merged.rate   ?? 1.0
    utterance.pitch  = merged.pitch  ?? 1.0
    utterance.volume = merged.volume ?? 1.0
    utterance.lang   = 'pt-BR'

    if (merged.voiceURI) {
      const v = window.speechSynthesis.getVoices().find(x => x.voiceURI === merged.voiceURI)
      if (v) utterance.voice = v
    } else {
      // pick best pt-BR voice
      const ptVoice = window.speechSynthesis.getVoices().find(v =>
        v.lang.startsWith('pt') && v.localService
      ) || window.speechSynthesis.getVoices().find(v => v.lang.startsWith('pt'))
      if (ptVoice) utterance.voice = ptVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => {
      // optional repeats
      if ((merged.repeatCount || 0) > 0) {
        queue.current.unshift({ text: item.text, opts: { ...item.opts, repeatCount: merged.repeatCount! - 1 } })
      }
      setIsSpeaking(false)
      processing.current = false
      processQueue()
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      processing.current = false
      processQueue()
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      processing.current = false
      setIsSpeaking(false)
    }
  }, [isSupported, defaultOpts])

  const speak = useCallback((text: string, opts: VoiceOptions = {}) => {
    if (!isSupported) return
    queue.current.push({ text, opts })
    processQueue()
  }, [isSupported, processQueue])

  const cancel = useCallback(() => {
    if (!isSupported) return
    queue.current = []
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    processing.current = false
  }, [isSupported])

  return { speak, cancel, isSpeaking, isSupported, voices }
}
