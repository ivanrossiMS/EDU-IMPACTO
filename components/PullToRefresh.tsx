'use client'

import React, { useState, useEffect, useRef } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<any>
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isPulling = currentY > startY
  const pullDistance = Math.max(0, currentY - startY)
  // Limit the visual pull distance
  const translateY = Math.min(pullDistance * 0.4, 60)

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only enable pull to refresh when scrolled to the top
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0 || refreshing) return
    const y = e.touches[0].clientY
    if (y > startY && window.scrollY <= 0) {
      // Prevent default scrolling when pulling down
      if (e.cancelable) e.preventDefault()
      setCurrentY(y)
    }
  }

  const handleTouchEnd = async () => {
    if (startY === 0) return
    
    if (translateY >= 50 && !refreshing) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setStartY(0)
        setCurrentY(0)
      }
    } else {
      setStartY(0)
      setCurrentY(0)
    }
  }

  // Effect to handle preventDefault on touchmove (required for some browsers)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (startY > 0 && e.touches[0].clientY > startY && window.scrollY <= 0) {
        if (e.cancelable) e.preventDefault()
      }
    }

    el.addEventListener('touchmove', handleTouchMoveNative, { passive: false })
    return () => el.removeEventListener('touchmove', handleTouchMoveNative)
  }, [startY])

  return (
    <div 
      ref={containerRef}
      className="relative w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="absolute top-0 left-0 w-full flex justify-center items-center transition-transform duration-200"
        style={{
          transform: `translateY(${refreshing ? 20 : translateY - 40}px)`,
          opacity: refreshing || isPulling ? 1 : 0,
          zIndex: 50
        }}
      >
        <div className="bg-white rounded-full shadow-md p-2 flex items-center justify-center">
          {refreshing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          ) : (
            <svg 
              className={`h-5 w-5 text-gray-500 transition-transform ${translateY >= 50 ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
        </div>
      </div>
      
      <div 
        className="transition-transform duration-200"
        style={{ transform: `translateY(${refreshing ? 50 : translateY}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
