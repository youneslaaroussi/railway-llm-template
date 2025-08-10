'use client'

import { useEffect } from 'react'

interface ErudaProps {
  /**
   * Whether to force enable Eruda regardless of environment
   * Useful for testing in production-like environments
   */
  forceEnable?: boolean

  /**
   * Whether to enable Eruda in development mode
   * Default: true
   */
  enableInDev?: boolean

  /**
   * Whether to enable Eruda in production mode
   * Default: false (but can be overridden with URL parameter)
   */
  enableInProd?: boolean

  /**
   * URL parameter name to enable Eruda
   * Default: 'debug'
   * Usage: ?debug=true or ?debug=1
   */
  urlParam?: string
}

export function Eruda({
}: ErudaProps = {}) {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    if (process.env.NEXT_PUBLIC_ERUDA_ENABLED === 'true') {
      // Dynamic import to avoid bundling Eruda in production unless needed
      import('eruda').then((eruda) => {
        const erudaContainer = document.createElement('div')
        document.body.appendChild(erudaContainer)

        eruda.default.init({
          container: erudaContainer,
          // Configuration options
          tool: ['console', 'elements', 'network', 'resource', 'info', 'snippets', 'sources'],
          autoScale: true,
          useShadowDom: true,
          defaults: {
            displaySize: 40,
            transparency: 0.9,
            theme: 'Monokai Pro'
          }
        })

        // Add custom styles for better mobile experience
        const style = document.createElement('style')
        style.textContent = `
          .eruda-dev-tools {
            z-index: 9999999 !important;
          }
          .eruda-entry-btn {
            opacity: 0.8 !important;
          }
          .eruda-entry-btn:hover {
            opacity: 1 !important;
          }
        `
        document.head.appendChild(style)

        // Store enabled state
        localStorage.setItem('eruda-enabled', 'true')

        console.log('🔧 Eruda debugging tools initialized')
        console.log('💡 Tip: Add ?debug=false to the URL to disable Eruda')
      }).catch((error) => {
        console.warn('Failed to load Eruda:', error)
      })
    } else {
      // Remove from localStorage if explicitly disabled
      if (process.env.NEXT_PUBLIC_ERUDA_ENABLED === 'false') {
        localStorage.removeItem('eruda-enabled')
      }
    }

    // Add keyboard shortcut to toggle Eruda (Ctrl/Cmd + Shift + D)
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault()

        const isCurrentlyEnabled = localStorage.getItem('eruda-enabled') === 'true'

        if (isCurrentlyEnabled) {
          localStorage.removeItem('eruda-enabled')
          window.location.reload()
        } else {
          localStorage.setItem('eruda-enabled', 'true')
          window.location.reload()
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)

    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  return null
}

// Utility function to manually enable/disable Eruda
export const toggleEruda = () => {
  if (typeof window === 'undefined') return

  const isEnabled = localStorage.getItem('eruda-enabled') === 'true'

  if (isEnabled) {
    localStorage.removeItem('eruda-enabled')
  } else {
    localStorage.setItem('eruda-enabled', 'true')
  }

  window.location.reload()
}
