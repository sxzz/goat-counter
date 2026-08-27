// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest'
import goatCounterPlugin from '../src/runtime/nuxt-plugin.ts'
import type { ResolvedModuleOptions } from '../src/nuxt.ts'
import type { Window as HappyDOMWindow } from 'happy-dom'

interface Route {
  fullPath: string
}

type AfterEach = (to: Route, from: Route, failure?: unknown) => void

interface RuntimeState {
  options: ResolvedModuleOptions
  afterEach?: AfterEach
  router: {
    currentRoute: { value: Route }
    afterEach: (callback: AfterEach) => () => void
  }
}

const runtime = vi.hoisted<RuntimeState>(() => ({
  options: {
    endpoint: '',
    enabled: true,
    autoPageviews: true,
    hashMode: false,
    allowLocal: false,
    allowFrame: false,
    params: {},
  },
  router: {
    currentRoute: { value: { fullPath: '/' } },
    afterEach: () => () => {},
  },
}))

vi.mock('nuxt/app', () => ({
  defineNuxtPlugin: (plugin: { setup: unknown }) => plugin.setup,
  useRouter: () => runtime.router,
  useRuntimeConfig: () => ({ public: { goatCounter: runtime.options } }),
}))

interface TestNuxtApp {
  hook: (name: string, callback: () => void) => void
}

interface PluginResult {
  provide: {
    goatCounter: {
      pageview: () => boolean
    }
  }
}

function setUrl(url: string): void {
  ;(globalThis as unknown as HappyDOMWindow).happyDOM.setURL(url)
}

function callPlugin(app: TestNuxtApp): PluginResult | undefined {
  const setup = goatCounterPlugin as unknown as (
    nuxtApp: TestNuxtApp,
  ) => PluginResult | undefined
  return setup(app)
}

function sentUrl(beacon: ReturnType<typeof vi.fn>): URL {
  const value = beacon.mock.calls.at(-1)?.[0]
  if (typeof value !== 'string') throw new TypeError('Beacon URL was not sent')
  return new URL(value)
}

beforeEach(() => {
  setUrl('https://example.com/initial')
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn(() => true),
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })

  runtime.options = {
    endpoint: 'https://stats.example.com/count',
    enabled: true,
    autoPageviews: true,
    hashMode: false,
    allowLocal: false,
    allowFrame: false,
    params: {},
  }
  runtime.afterEach = undefined
  runtime.router = {
    currentRoute: { value: { fullPath: '/initial' } },
    afterEach: vi.fn((callback: AfterEach) => {
      runtime.afterEach = callback
      return () => {}
    }),
  }
})

describe('Nuxt runtime plugin', () => {
  test('tracks the initial page and successful navigations', async () => {
    const hooks = new Map<string, () => void>()
    const result = callPlugin({
      hook: (name, callback) => hooks.set(name, callback),
    })
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(result?.provide.goatCounter).toBeDefined()
    hooks.get('app:mounted')?.()
    expect(sentUrl(beacon).searchParams.get('p')).toBe('/initial')

    runtime.afterEach?.({ fullPath: '/next?tab=one' }, { fullPath: '/initial' })
    await Promise.resolve()
    expect(sentUrl(beacon).searchParams.get('p')).toBe('/next?tab=one')

    runtime.afterEach?.(
      { fullPath: '/next?tab=one#details' },
      { fullPath: '/next?tab=one' },
    )
    await Promise.resolve()
    expect(beacon).toHaveBeenCalledTimes(2)

    runtime.afterEach?.(
      { fullPath: '/failed' },
      { fullPath: '/next?tab=one' },
      new Error('cancelled'),
    )
    await Promise.resolve()
    expect(beacon).toHaveBeenCalledTimes(2)
  })

  test('includes hashes when hashMode is enabled', async () => {
    runtime.options.hashMode = true
    callPlugin({ hook: vi.fn() })
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    runtime.afterEach?.(
      { fullPath: '/initial#details' },
      { fullPath: '/initial' },
    )
    await Promise.resolve()

    expect(sentUrl(beacon).searchParams.get('p')).toBe('/initial#details')
  })

  test('lets a configured path override automatic route paths', () => {
    runtime.options.params = { path: '/fixed' }
    const hooks = new Map<string, () => void>()
    callPlugin({ hook: (name, callback) => hooks.set(name, callback) })
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    hooks.get('app:mounted')?.()

    expect(sentUrl(beacon).searchParams.get('p')).toBe('/fixed')
  })

  test('can initialize without automatic pageviews', () => {
    runtime.options.autoPageviews = false
    const hook = vi.fn()
    const result = callPlugin({ hook })
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(result?.provide.goatCounter).toBeDefined()
    expect(runtime.router.afterEach).not.toHaveBeenCalled()
    expect(hook).not.toHaveBeenCalled()
    expect(beacon).not.toHaveBeenCalled()
  })

  test('does nothing when disabled', () => {
    runtime.options.enabled = false
    const hook = vi.fn()
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(callPlugin({ hook })).toBeUndefined()
    expect(runtime.router.afterEach).not.toHaveBeenCalled()
    expect(hook).not.toHaveBeenCalled()
    expect(beacon).not.toHaveBeenCalled()
  })

  test('warns and stays disabled without an endpoint', () => {
    runtime.options.endpoint = ''
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(callPlugin({ hook: vi.fn() })).toBeUndefined()
    expect(warning).toHaveBeenCalledWith(
      '[goat-counter] Tracking is enabled but no endpoint is configured.',
    )
  })
})
