'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

interface ListSkeletonProps {
  count?: number
}

export function ListSkeleton({ count = 3 }: ListSkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{ background: '#fff', padding: '16px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
            <Skeleton w="120px" h={20} />
            <Skeleton w="200px" h={16} />
          </div>
          <Skeleton w="100px" h={32} borderRadius={6} />
        </div>
      ))}
    </div>
  )
}
