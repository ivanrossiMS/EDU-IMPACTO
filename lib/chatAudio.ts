// lib/chatAudio.ts
/**
 * Sintetizador de áudio Web Audio API para sons fiéis do WhatsApp:
 * - Som de envio de mensagem (o clique suave/pop sutil do WhatsApp)
 * - Som de recebimento de mensagem (o tom clássico duplo do WhatsApp Web)
 * 100% nativo, sem dependência de arquivos externos ou falhas de rede.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Toca o som característico de mensagem enviada (WhatsApp Sent Tick)
 */
export function playWhatsAppSendSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.09)
  } catch (_) {}
}

/**
 * Toca o som característico de mensagem recebida (WhatsApp Receive Chime - 2 tons)
 */
export function playWhatsAppReceiveSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    
    // Primeiro tom (marimba suave)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now) // A5
    gain1.gain.setValueAtTime(0.18, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.13)

    // Segundo tom (mais agudo, o clássico "ding" do WhatsApp)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1318.51, now + 0.09) // E6
    gain2.gain.setValueAtTime(0.22, now + 0.09)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.09)
    osc2.stop(now + 0.3)
  } catch (_) {}
}
