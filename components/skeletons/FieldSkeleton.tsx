'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

interface FieldSkeletonProps {
  label?: boolean
  width?: string | number
}

export function FieldSkeleton({ label = true, width = '100%' }: FieldSkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width }}>
      {label && <Skeleton w="30%" h={12} />}
      <Skeleton w="100%" h={40} borderRadius={8} />
    </div>
  )
}
