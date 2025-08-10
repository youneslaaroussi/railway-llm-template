'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import * as gtag from '@/lib/gtag'

export const useAnalytics = () => {
  const pathname = usePathname()

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      gtag.GA_TRACKING_ID &&
      typeof window.gtag === 'function'
    ) {
      gtag.pageview(new URL(pathname, window.location.origin))
    }
  }, [pathname])

  const trackEvent = (
    action: string,
    category: string,
    label: string,
    value: number,
  ) => {
    if (
      process.env.NODE_ENV === 'production' &&
      gtag.GA_TRACKING_ID &&
      typeof window.gtag === 'function'
    ) {
      gtag.event({ action, category, label, value })
    }
  }

  return { trackEvent }
} 