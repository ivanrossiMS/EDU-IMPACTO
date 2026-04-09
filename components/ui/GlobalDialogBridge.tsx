'use client'
/**
 * GlobalDialogBridge
 * 
 * Mounts once inside DialogProvider to expose window.__uiAlert and window.__uiConfirm
 * so that legacy alert() / confirm() calls can gradually migrate.
 * The actual replacement is done via the useDialog hook in each page component.
 */
import { useEffect } from 'react'
import { useDialog } from '@/lib/dialogContext'

export function GlobalDialogBridge() {
  const { alert: dlgAlert, confirm: dlgConfirm } = useDialog()

  useEffect(() => {
    (window as any).__uiAlert = dlgAlert;
    (window as any).__uiConfirm = dlgConfirm;
  }, [dlgAlert, dlgConfirm])

  return null
}
