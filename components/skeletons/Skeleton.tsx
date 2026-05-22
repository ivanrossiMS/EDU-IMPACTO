'use client'

import React from 'react'

// Nota: a animação skeleton-shimmer está definida globalmente em globals.css
// Não injetamos <style> aqui para evitar duplicação e recalculate-style desnecessário

interface SkeletonProps {
  w?: string | number
  h?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
  className?: string
}

export function Skeleton({ w = '100%', h = 16, borderRadius = 8, style = {}, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ width: w, height: h, borderRadius, ...style }}
    />
  )
}

