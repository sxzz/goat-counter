import { init, type GoatCounterClient } from '../index.ts'
import type { ResolvedModuleOptions } from '../nuxt.ts'

declare const __GOAT_COUNTER_OPTIONS__: ResolvedModuleOptions

let client: GoatCounterClient | undefined

export function getClient(): GoatCounterClient | undefined {
  return client
}

export function initAstroClient(): void {
  if (client || typeof document === 'undefined') return

  const options = __GOAT_COUNTER_OPTIONS__

  if (!options.enabled) return
  if (!options.endpoint) return

  try {
    client = init({
      endpoint: options.endpoint,
      allowLocal: options.allowLocal,
      allowFrame: options.allowFrame,
      params: options.params,
    })
  } catch {
    return
  }

  if (!options.autoPageviews) return

  const activeClient = client
  const hashMode = options.hashMode
  const hasConfiguredPath = Object.prototype.hasOwnProperty.call(
    options.params,
    'path',
  )
  let lastTrackedPath = ''

  const trackPageview = (
    pathname: string,
    search: string,
    hash: string,
  ): void => {
    const fullPath = `${pathname}${search}${hashMode ? hash : ''}`
    if (fullPath === lastTrackedPath) return
    lastTrackedPath = fullPath

    const params = hasConfiguredPath ? undefined : { path: fullPath || '/' }
    activeClient.pageview(params)
  }

  document.addEventListener('astro:page-load', () => {
    const { pathname, search, hash } = location
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        trackPageview(pathname, search, hash)
      }),
    )
  })
}
