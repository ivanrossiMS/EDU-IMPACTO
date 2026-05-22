'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

interface CardSkeletonProps {
  count?: number
}

export function CardSkeleton({ count = 1 }: CardSkeletonProps) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Skeleton w="40%" h={14} />
          <Skeleton w="70%" h={28} />
          <Skeleton w="30%" h={12} />
        </div>
      ))}
    </>
  )
}
