import { init, type GoatCounterClient } from '../index.ts'
import type { ResolvedAstroOptions } from './index.ts'

let goatCounter: GoatCounterClient | undefined

export function getGoatCounter(): GoatCounterClient | undefined {
  return goatCounter
}

export function initAstroClient(options: ResolvedAstroOptions): void {
  if (goatCounter || typeof document === 'undefined') return

  if (!options.enabled) return
  if (!options.endpoint) return

  try {
    goatCounter = init({
      endpoint: options.endpoint,
      allowLocal: options.allowLocal,
      allowFrame: options.allowFrame,
      params: options.params,
    })
  } catch (error) {
    console.warn(
      '[goat-counter] Invalid endpoint; tracking is disabled.',
      error,
    )
    return
  }

  if (!options.autoPageviews) return

  const activeGoatCounter = goatCounter
  const hasConfiguredPath = Object.prototype.hasOwnProperty.call(
    options.params,
    'path',
  )
  let pageTracked = false
  let loadedPagePath: string | undefined
  let lastHash = ''

  const trackRoute = (pathname: string, search: string, hash: string): void => {
    const fullPath = `${pathname}${search}${options.hashMode ? hash : ''}`
    const params = hasConfiguredPath ? undefined : { path: fullPath || '/' }
    activeGoatCounter.pageview(params)
  }

  const onPageLoad = (): void => {
    if (pageTracked) return
    pageTracked = true
    const { pathname, search, hash } = location
    loadedPagePath = `${pathname}${search}`
    lastHash = hash
    trackRoute(pathname, search, hash)
  }

  document.addEventListener('astro:after-swap', () => {
    pageTracked = false
  })
  document.addEventListener('astro:page-load', onPageLoad)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageLoad, { once: true })
  } else {
    onPageLoad()
  }

  if (options.hashMode) {
    const onHashChange = (): void => {
      const { pathname, search, hash } = location
      if (!pageTracked || `${pathname}${search}` !== loadedPagePath) return
      if (hash === lastHash) return
      lastHash = hash
      trackRoute(pathname, search, hash)
    }

    addEventListener('hashchange', onHashChange)
    addEventListener('popstate', onHashChange)
  }
}
