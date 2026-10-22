/**
 * nativeSettings.ts — Ponte nativa para abertura dos Ajustes / Configurações do Sistema.
 *
 * Utiliza o plugin Capacitor customizado NativeSettings registrado nativamente no
 * AppDelegate.swift (iOS) e MainActivity.java (Android).
 */

import { registerPlugin, Capacitor } from '@capacitor/core'

export interface NativeSettingsPlugin {
  openSettings(): Promise<{ opened?: boolean }>
  saveImage(options: { base64: string; fileName: string }): Promise<{ saved?: boolean; uri?: string }>
  shareImage(options: {
    base64: string
    fileName: string
    title?: string
    text?: string
  }): Promise<{ shared?: boolean }>
}

export const NativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings', {
  web: () => ({
    openSettings: async () => {
      console.warn('[NativeSettings] Abertura de Ajustes não suportada no navegador web.')
      return { opened: false }
    },
    saveImage: async () => ({ saved: false }),
    shareImage: async () => ({ shared: false }),
  }),
})

/**
 * Abre os ajustes específicos do aplicativo no dispositivo.
 * Retorna true se abriu com sucesso ou false caso contrário.
 */
export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[NativeSettings] Plataforma não é nativa.')
    return false
  }

  try {
    const res = await NativeSettings.openSettings()
    return res?.opened !== false
  } catch (err: any) {
    console.error('[NativeSettings] Erro ao abrir ajustes nativos:', err)
    return false
  }
}
