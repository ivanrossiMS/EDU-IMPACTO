'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile, Image as ImageIcon, Mic, Square, Loader2 } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import EmojiPicker from 'emoji-picker-react'

interface ChatComposerProps {
  onSendMessage: (content: string, type?: 'text' | 'image' | 'video' | 'file' | 'audio') => void
  disabled?: boolean
}

export function ChatComposer({ onSendMessage, disabled }: ChatComposerProps) {
  const [text, setText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const handleSend = () => {
    if (text.trim() && !disabled && !isUploading) {
      onSendMessage(text.trim(), 'text')
      setText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const onEmojiClick = (emojiData: any) => {
    setText(prev => prev + emojiData.emoji)
  }

  const uploadMedia = async (file: File) => {
    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'comunicados-midia') 

      const res = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })
      
      const text = await res.text()
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch (e) {
        console.error('Failed to parse response:', text)
        throw new Error('Erro na resposta do servidor')
      }
      
      if (!res.ok) throw new Error(data.error || 'Erro ao fazer upload')

      const isImage = file.type.startsWith('image/')
      const isAudio = file.type.startsWith('audio/')
      const isVideo = file.type.startsWith('video/')
      const type = isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'file'

      // Include file name and URL in content if it's a file
      const content = isImage || isAudio || isVideo ? data.url : JSON.stringify({ url: data.url, name: file.name, size: file.size })
      
      onSendMessage(content, type)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Erro ao enviar arquivo. Verifique o tamanho (máx 50MB).')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMedia(file)
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Detect supported mime types (Safari does not support audio/webm)
      let mimeType = 'audio/webm'
      let extension = 'webm'
      
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
          extension = 'webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
          extension = 'mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
          extension = 'ogg'
        } else {
          mimeType = '' // browser default
          extension = 'wav' // safe fallback
        }
      }

      const options = mimeType ? { mimeType } : undefined
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime })
        const file = new File([audioBlob], `audio_${Date.now()}.${extension}`, { type: actualMime })
        await uploadMedia(file)
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error accessing microphone', err)
      alert('Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ padding: '16px 20px', background: 'white', borderTop: '1px solid rgba(0,0,0,0.03)', zIndex: 10 }}>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: '#f8fafc', 
        borderRadius: 40, 
        padding: '6px 6px 6px 16px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {isRecording ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 600 }}>Gravando... {formatTime(recordingTime)}</span>
          </div>
        ) : (
          <>
            <button 
              type="button"
              style={{ 
              width: 32, 
              height: 32, 
              borderRadius: '50%', 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#64748b', 
              cursor: 'pointer',
              flexShrink: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            
            <input 
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || isUploading}
              placeholder={isUploading ? "Enviando arquivo..." : "Digite sua mensagem..."} 
              style={{ 
                flex: 1, 
                padding: '0 12px', 
                background: 'transparent',
                border: 'none', 
                fontSize: 15,
                color: '#334155',
                outline: 'none',
                minWidth: 0
              }} 
            />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" disabled={disabled || isUploading} style={{ padding: 6, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#64748b'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                    <Smile size={20} />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content sideOffset={10} align="end" style={{ zIndex: 100 }}>
                    <EmojiPicker onEmojiClick={onEmojiClick} />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading} 
                style={{ padding: 6, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }} 
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'} 
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                <Paperclip size={20} />
              </button>
              
              <button 
                type="button"
                onClick={startRecording}
                disabled={disabled || isUploading} 
                style={{ padding: 8, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }} 
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'} 
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                <Mic size={20} />
              </button>
            </div>
          </>
        )}

        {isRecording ? (
          <button 
            onClick={stopRecording}
            style={{ 
              width: 44,
              height: 44,
              background: '#ef4444', 
              color: 'white', 
              border: 'none', 
              borderRadius: '50%', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button 
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !isUploading)}
            style={{ 
              width: 44,
              height: 44,
              background: (text.trim() || isUploading) ? '#6366f1' : '#e2e8f0', 
              color: 'white', 
              border: 'none', 
              borderRadius: '50%', 
              cursor: (text.trim() || isUploading) ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: (text.trim() || isUploading) ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
            }}
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} style={{ marginLeft: 2 }} />}
          </button>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}
