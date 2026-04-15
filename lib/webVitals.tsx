'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

type MetricName = 'LCP' | 'FCP' | 'TTFB' | 'CLS' | 'INP' | 'FID'

interface WebVitalMetric {
  name: MetricName
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string
  route: string
  timestamp: number
}

const THRESHOLDS: Record<MetricName, [number, number]> = {
  LCP:  [2500, 4000],
  FCP:  [1800, 3000],
  TTFB: [800,  1800],
  CLS:  [0.1,  0.25],
  INP:  [200,  500],
  FID:  [100,  300],
}

function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = THRESHOLDS[name] || [Infinity, Infinity]
  if (value <= good) return 'good'
  if (value <= poor) return 'needs-improvement'
  return 'poor'
}

function formatValue(name: MetricName, value: number): string {
  if (name === 'CLS') return value.toFixed(3)
  return `${Math.round(value)}ms`
}

const RATING_EMOJI: Record<string, string> = {
  good: '🟢',
  'needs-improvement': '🟡',
  poor: '🔴',
}

// Buffer to batch metrics before sending
const metricsBuffer: WebVitalMetric[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flushMetrics() {
  if (metricsBuffer.length === 0) return
  const batch = [...metricsBuffer]
  metricsBuffer.length = 0

  // Log to console grouped by route
  const byRoute = new Map<string, WebVitalMetric[]>()
  batch.forEach(m => {
    const list = byRoute.get(m.route) || []
    list.push(m)
    byRoute.set(m.route, list)
  })

  byRoute.forEach((metrics, route) => {
    console.groupCollapsed(
      `%c⚡ Web Vitals %c${route}`,
      'color: #3b82f6; font-weight: 700',
      'color: #94a3b8; font-weight: 400'
    )
    metrics.forEach(m => {
      const emoji = RATING_EMOJI[m.rating]
      const color = m.rating === 'good' ? '#10b981' : m.rating === 'poor' ? '#f43f5e' : '#f59e0b'
      console.log(
        `${emoji} %c${m.name}%c ${formatValue(m.name, m.value)} %c(${m.rating})`,
        'font-weight: 700; color: inherit',
        `color: ${color}; font-weight: 700`,
        'color: #6b7280; font-weight: 400'
      )
    })
    console.groupEnd()
  })

  // Persist to system_logs API (fire-and-forget, non-blocking)
  if (typeof fetch !== 'undefined') {
    fetch('/api/system-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modulo: 'Performance',
        acao: 'WEB_VITALS',
        descricao: `Web Vitals batch (${batch.length} metrics)`,
        dados: batch.map(m => ({
          name: m.name,
          value: m.value,
          rating: m.rating,
          route: m.route,
          timestamp: m.timestamp,
        })),
      }),
    }).catch(() => {})
  }
}

function reportMetric(metric: WebVitalMetric) {
  metricsBuffer.push(metric)
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flushMetrics, 3000)
}

/**
 * WebVitalsReporter component — place once in the root layout.
 * Collects LCP, FCP, TTFB, CLS, INP using the web-vitals library pattern
 * via PerformanceObserver (no external dependency needed).
 */
export function WebVitalsReporter() {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return

    const observers: PerformanceObserver[] = []

    const createMetric = (name: MetricName, value: number): WebVitalMetric => ({
      name,
      value,
      rating: getRating(name, value),
      navigationType: (performance.getEntriesByType?.('navigation')?.[0] as any)?.type || 'navigate',
      route: pathnameRef.current,
      timestamp: Date.now(),
    })

    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) reportMetric(createMetric('LCP', lastEntry.startTime))
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      observers.push(lcpObserver)
    } catch {}

    // FCP
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const fcpEntry = entries.find(e => e.name === 'first-contentful-paint')
        if (fcpEntry) reportMetric(createMetric('FCP', fcpEntry.startTime))
      })
      fcpObserver.observe({ type: 'paint', buffered: true })
      observers.push(fcpObserver)
    } catch {}

    // CLS
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
          }
        }
        reportMetric(createMetric('CLS', clsValue))
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
      observers.push(clsObserver)
    } catch {}

    // INP (Interaction to Next Paint)
    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ((entry as any).interactionId) {
            reportMetric(createMetric('INP', entry.duration))
          }
        }
      })
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any)
      observers.push(inpObserver)
    } catch {}

    // TTFB (from navigation timing)
    try {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navEntry) {
        const ttfb = navEntry.responseStart - navEntry.requestStart
        if (ttfb > 0) reportMetric(createMetric('TTFB', ttfb))
      }
    } catch {}

    return () => {
      observers.forEach(o => o.disconnect())
      // Flush remaining metrics
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
      flushMetrics()
    }
  }, [])

  return null
}
