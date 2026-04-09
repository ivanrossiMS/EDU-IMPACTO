'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { UiDialog, DialogOptions, DialogType } from '@/components/ui/UiDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DialogState {
  open: boolean
  options: DialogOptions & { isConfirm: boolean }
  resolve: (value: boolean) => void
}

interface DialogContextValue {
  alert: (message: string, options?: Partial<Omit<DialogOptions, 'message'>>) => Promise<void>
  confirm: (message: string, options?: Partial<Omit<DialogOptions, 'message'>>) => Promise<boolean>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue>({
  alert: async () => {},
  confirm: async () => false,
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const openDialog = useCallback((options: DialogOptions & { isConfirm: boolean }) => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve
      setState({ open: true, options, resolve })
    })
  }, [])

  const handleOk = useCallback(() => {
    resolveRef.current?.(true)
    setState(null)
  }, [])

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false)
    setState(null)
  }, [])

  const alert = useCallback(async (message: string, options?: Partial<Omit<DialogOptions, 'message'>>) => {
    await openDialog({ message, isConfirm: false, ...options })
  }, [openDialog])

  const confirm = useCallback(async (message: string, options?: Partial<Omit<DialogOptions, 'message'>>) => {
    return openDialog({ message, isConfirm: true, type: 'confirm', ...options })
  }, [openDialog])

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      {state?.open && (
        <UiDialog
          {...state.options}
          onOk={handleOk}
          onCancel={handleCancel}
        />
      )}
    </DialogContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDialog() {
  return useContext(DialogContext)
}
