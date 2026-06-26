'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { VisualFormulaModal } from '../simulados/VisualFormulaModal';

type KeyboardContextType = {
  isOpen: boolean;
  openKeyboard: (options: { onInsert: (latex: string) => void }) => void;
  closeKeyboard: () => void;
};

const KeyboardContext = createContext<KeyboardContextType | undefined>(undefined);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const onInsertRef = useRef<(latex: string) => void>(() => {});

  const openKeyboard = useCallback((options: { onInsert: (latex: string) => void }) => {
    onInsertRef.current = options.onInsert;
    setIsOpen(true);
  }, []);

  const closeKeyboard = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSave = useCallback((latex: string) => {
    onInsertRef.current(latex);
    // Don't auto-close if the user might want to insert multiple times?
    // According to standard workflow, close it after insert.
    setIsOpen(false);
  }, []);

  return (
    <KeyboardContext.Provider value={{ isOpen, openKeyboard, closeKeyboard }}>
      {children}
      <VisualFormulaModal 
        open={isOpen} 
        onClose={closeKeyboard} 
        onSave={handleSave} 
      />
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
}
