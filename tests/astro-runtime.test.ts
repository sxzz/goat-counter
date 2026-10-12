// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ResolvedAstroOptions } from '../src/astro/index.ts'
import type { GoatCounterPageviewParams } from '../src/index.ts'
import type { Window as HappyDOMWindow } from 'happy-dom'

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  client: {
    pageview: vi.fn<(params?: GoatCounterPageviewParams) => boolean>(),
    event: vi.fn(),
    count: vi.fn(),
  },
}))

vi.mock('../src/index.ts', () => ({ init: sdk.init }))

const options: ResolvedAstroOptions = {
  endpoint: 'https://stats.example.com/count',
  enabled: true,
  autoPageviews: true,
  hashMode: false,
  allowLocal: false,
  allowFrame: true,
  params: {},
}

const listeners: Array<{
  target: EventTarget
  name: string
  listener: EventListenerOrEventListenerObject
}> = []

function setUrl(path: string): void {
  ;(globalThis as unknown as HappyDOMWindow).happyDOM.setURL(
    `https://example.com${path}`,
  )
}

function setReadyState(value: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, value })
}

function trackedPaths(): Array<GoatCounterPageviewParams['path']> {
  return sdk.client.pageview.mock.calls.map(([params]) => params?.path)
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  sdk.init.mockReturnValue(sdk.client)
  sdk.client.pageview.mockReturnValue(true)
  setUrl('/initial')
  setReadyState('complete')
  for (const target of [document, globalThis]) {
    const add = target.addEventListener.bind(target)
    vi.spyOn(target, 'addEventListener').mockImplementation(
      (name, listener, settings) => {
        if (listener) listeners.push({ target, name, listener })
        add(name, listener, settings)
      },
    )
  }
})

afterEach(() => {
  for (const { target, name, listener } of listeners.splice(0)) {
    target.removeEventListener(name, listener)
  }
  vi.restoreAllMocks()
})

describe('Astro runtime client', () => {
  test.each(['interactive', 'complete'] as const)(
    'tracks a parsed document without waiting for resources: %s',
    async (readyState) => {
      setReadyState(readyState)
      const { initAstroClient } = await import('../src/astro/runtime.ts')
      initAstroClient(options)
      expect(trackedPaths()).toEqual(['/initial'])
    },
  )

  test.each(['dom-first', 'astro-first'])(
    'tracks the initial page once when DOM and Astro events fire: %s',
    async (order) => {
      setReadyState('loading')
      const { initAstroClient } = await import('../src/astro/runtime.ts')
      initAstroClient(options)
      expect(trackedPaths()).toEqual([])
      const domReady = (): boolean =>
        document.dispatchEvent(new Event('DOMContentLoaded'))
      const astro = (): boolean =>
        document.dispatchEvent(new Event('astro:page-load'))
      if (order === 'dom-first') {
        domReady()
        astro()
      } else {
        astro()
        domReady()
      }
      expect(trackedPaths()).toEqual(['/initial'])
    },
  )

  test('waits for DOMContentLoaded without ClientRouter', async () => {
    setReadyState('loading')
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    initAstroClient(options)
    expect(sdk.client.pageview).not.toHaveBeenCalled()
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(trackedPaths()).toEqual(['/initial'])
  })

  test('tracks completed navigations and ignores hashes by default', async () => {
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    initAstroClient(options)
    setUrl('/initial#section')
    dispatchEvent(new Event('hashchange'))
    dispatchEvent(new Event('popstate'))
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual(['/initial'])

    setUrl('/next?tab=one#details')
    document.dispatchEvent(new Event('astro:after-swap'))
    expect(trackedPaths()).toEqual(['/initial'])
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual(['/initial', '/next?tab=one'])
  })

  test('tracks hashes and same-document history without duplicate views', async () => {
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    initAstroClient({ ...options, hashMode: true })
    setUrl('/initial#section')
    dispatchEvent(new Event('hashchange'))
    document.dispatchEvent(new Event('astro:page-load'))
    setUrl('/initial')
    dispatchEvent(new Event('popstate'))
    dispatchEvent(new Event('hashchange'))
    setUrl('/initial#section')
    dispatchEvent(new Event('popstate'))
    expect(trackedPaths()).toEqual([
      '/initial',
      '/initial#section',
      '/initial',
      '/initial#section',
    ])
  })

  test('waits for page-load before tracking cross-page history', async () => {
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    initAstroClient({ ...options, hashMode: true })
    setUrl('/next?tab=one#details')
    dispatchEvent(new Event('popstate'))
    dispatchEvent(new Event('hashchange'))
    expect(trackedPaths()).toEqual(['/initial'])
    document.dispatchEvent(new Event('astro:after-swap'))
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual(['/initial', '/next?tab=one#details'])
  })

  test('passes options to the SDK and preserves its configured path', async () => {
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    const configured = { ...options, params: { path: '/fixed' } }
    initAstroClient(configured)
    expect(sdk.init).toHaveBeenCalledWith({
      endpoint: configured.endpoint,
      allowLocal: configured.allowLocal,
      allowFrame: configured.allowFrame,
      params: configured.params,
    })
    setUrl('/next')
    document.dispatchEvent(new Event('astro:after-swap'))
    document.dispatchEvent(new Event('astro:page-load'))
    expect(sdk.client.pageview.mock.calls).toEqual([[undefined], [undefined]])
  })

  test('keeps the client available with automatic tracking disabled', async () => {
    const { initAstroClient, getGoatCounter } =
      await import('../src/astro/runtime.ts')
    initAstroClient({ ...options, autoPageviews: false })
    document.dispatchEvent(new Event('DOMContentLoaded'))
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual([])
    expect(getGoatCounter()).toBe(sdk.client)
  })

  test('counts a new document at the same URL as a new view', async () => {
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    initAstroClient(options)
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual(['/initial'])

    document.dispatchEvent(new Event('astro:after-swap'))
    document.dispatchEvent(new Event('astro:page-load'))
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual(['/initial', '/initial'])
  })

  test('waits for page-load when a hash event arrives after a same-URL swap', async () => {
    const { initAstroClient } = await import('../src/astro/runtime.ts')
    initAstroClient({ ...options, hashMode: true })
    document.dispatchEvent(new Event('astro:after-swap'))
    setUrl('/initial#details')
    dispatchEvent(new Event('popstate'))
    dispatchEvent(new Event('hashchange'))
    expect(trackedPaths()).toEqual(['/initial'])

    document.dispatchEvent(new Event('astro:page-load'))
    dispatchEvent(new Event('hashchange'))
    expect(trackedPaths()).toEqual(['/initial', '/initial#details'])
  })

  test.each([{ enabled: false }, { endpoint: '' }])(
    'does not initialize when options disable tracking: %j',
    async (overrides) => {
      const { initAstroClient, getGoatCounter } =
        await import('../src/astro/runtime.ts')
      initAstroClient({ ...options, ...overrides })
      document.dispatchEvent(new Event('DOMContentLoaded'))
      document.dispatchEvent(new Event('astro:page-load'))
      expect(sdk.init).not.toHaveBeenCalled()
      expect(sdk.client.pageview).not.toHaveBeenCalled()
      expect(getGoatCounter()).toBeUndefined()
    },
  )

  test('warns and remains uninitialized when the SDK rejects initialization', async () => {
    const error = new TypeError('Invalid endpoint')
    sdk.init.mockImplementation(() => {
      throw error
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initAstroClient, getGoatCounter } =
      await import('../src/astro/runtime.ts')
    initAstroClient(options)
    expect(warning).toHaveBeenCalledWith(
      '[goat-counter] Invalid endpoint; tracking is disabled.',
      error,
    )
    expect(getGoatCounter()).toBeUndefined()
    expect(sdk.client.pageview).not.toHaveBeenCalled()
  })

  test('initializes once and exposes the shared client', async () => {
    const { initAstroClient, getGoatCounter } =
      await import('../src/astro/runtime.ts')
    expect(getGoatCounter()).toBeUndefined()
    initAstroClient(options)
    initAstroClient(options)
    expect(sdk.init).toHaveBeenCalledTimes(1)
    expect(getGoatCounter()).toBe(sdk.client)
    setUrl('/next')
    document.dispatchEvent(new Event('astro:after-swap'))
    document.dispatchEvent(new Event('astro:page-load'))
    expect(trackedPaths()).toEqual(['/initial', '/next'])
  })
})
