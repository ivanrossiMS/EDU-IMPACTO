'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 5 }: TableSkeletonProps) {
  return (
    <>
      {[...Array(rows)].map((_, r) => (
        <tr key={r}>
          {[...Array(cols)].map((_, c) => (
            <td key={c} style={{ padding: '16px' }}>
              <Skeleton w="80%" h={16} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
