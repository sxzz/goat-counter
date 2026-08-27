// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { init, type GoatCounterFilterContext } from '../src/index.ts'
import type { Window as HappyDOMWindow } from 'happy-dom'

const endpoint = 'https://stats.example.com/count?keep=yes&p=old'

function setUrl(url: string): void {
  ;(globalThis as unknown as HappyDOMWindow).happyDOM.setURL(url)
}

function setDocumentProperty(name: string, value: unknown): void {
  Object.defineProperty(document, name, {
    configurable: true,
    value,
  })
}

function setNavigatorProperty(name: string, value: unknown): void {
  Object.defineProperty(navigator, name, {
    configurable: true,
    value,
  })
}

function beaconUrl(beacon: ReturnType<typeof vi.fn>): URL {
  const value = beacon.mock.calls.at(-1)?.[0]
  if (typeof value !== 'string') throw new TypeError('Beacon URL was not sent')
  return new URL(value)
}

beforeEach(() => {
  setUrl('https://example.com/docs?utm_source=test')
  document.head.replaceChildren()
  document.body.replaceChildren()
  document.title = 'Documentation'
  setDocumentProperty('referrer', 'https://ref.example/from')
  setDocumentProperty('visibilityState', 'visible')
  Object.defineProperty(window.screen, 'width', {
    configurable: true,
    value: 1440,
  })
  setNavigatorProperty('webdriver', false)
  setNavigatorProperty(
    'sendBeacon',
    vi.fn(() => true),
  )
  Object.defineProperty(globalThis, 'top', {
    configurable: true,
    value: globalThis,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initialization', () => {
  test('requires an absolute endpoint without sending a request', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(() => init({ endpoint: '/count' })).toThrow(
      'endpoint must be an absolute URL',
    )

    init({ endpoint: new URL(endpoint) })
    expect(beacon).not.toHaveBeenCalled()
  })

  test('does not track when disabled', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint, enabled: false })

    expect(client.pageview()).toBe(false)
    expect(beacon).not.toHaveBeenCalled()
  })
})

describe('protocol data', () => {
  test('sends browser defaults and honors a same-host canonical URL', () => {
    document.head.innerHTML =
      '<link rel="canonical" href="https://www.example.com/canonical?x=1">'
    document.title = 'Documentation'
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint })

    expect(client.pageview()).toBe(true)

    const url = beaconUrl(beacon)
    expect(url.origin + url.pathname).toBe('https://stats.example.com/count')
    expect(url.searchParams.get('keep')).toBe('yes')
    expect(url.searchParams.get('p')).toBe('/canonical?x=1')
    expect(url.searchParams.get('t')).toBe('Documentation')
    expect(url.searchParams.get('r')).toBe('https://ref.example/from')
    expect(url.searchParams.get('s')).toBe('1440')
    expect(url.searchParams.get('q')).toBe('?utm_source=test')
    expect(url.searchParams.get('b')).toBe('0')
    expect(url.searchParams.has('rnd')).toBe(false)
    expect(url.searchParams.has('e')).toBe(false)
    expect(url.searchParams.has('ns')).toBe(false)
  })

  test('ignores a cross-host canonical URL', () => {
    document.head.innerHTML =
      '<link rel="canonical" href="https://other.example/canonical">'
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    init({ endpoint }).pageview()

    expect(beaconUrl(beacon).searchParams.get('p')).toBe(
      '/docs?utm_source=test',
    )
  })

  test('reads browser defaults for every request and URL-encodes values', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint })

    setUrl('https://example.com/%E6%90%9C%E7%B4%A2?term=a+b&tag=%E2%9C%93')
    document.title = 'Search + results ✓'
    client.pageview()

    const url = beaconUrl(beacon)
    expect(url.searchParams.get('p')).toBe(
      '/%E6%90%9C%E7%B4%A2?term=a+b&tag=%E2%9C%93',
    )
    expect(url.searchParams.get('t')).toBe('Search + results ✓')
    expect(url.searchParams.get('q')).toBe('?term=a+b&tag=%E2%9C%93')
  })

  test('supports every protocol override', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    setNavigatorProperty('webdriver', true)

    const result = init({ endpoint }).count({
      path: '/virtual',
      title: '',
      referrer: () => null,
      event: true,
      noSession: true,
      screen: { width: 1920, height: 1080, pixelRatio: 2 },
      query: '?campaign=launch',
      bot: (defaultBot) => defaultBot,
    })

    expect(result).toBe(true)
    const query = beaconUrl(beacon).searchParams
    expect(query.get('p')).toBe('/virtual')
    expect(query.has('t')).toBe(false)
    expect(query.has('r')).toBe(false)
    expect(query.get('e')).toBe('true')
    expect(query.get('ns')).toBe('true')
    expect(query.get('s')).toBe('1920,1080,2')
    expect(query.get('q')).toBe('?campaign=launch')
    expect(query.get('b')).toBe('153')
    expect(query.has('rnd')).toBe(false)
  })

  test('gives per-call resolvers the browser default and highest priority', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const initialResolver = vi.fn((path: string) => `/initial${path}`)
    const callResolver = vi.fn((path: string) => `/call${path}`)
    const client = init({
      endpoint,
      params: { path: initialResolver, title: 'Initial title' },
    })

    client.count({ path: callResolver, title: 'Call title' })

    expect(initialResolver).not.toHaveBeenCalled()
    expect(callResolver).toHaveBeenCalledWith('/docs?utm_source=test')
    const query = beaconUrl(beacon).searchParams
    expect(query.get('p')).toBe('/call/docs?utm_source=test')
    expect(query.get('t')).toBe('Call title')
  })

  test('cancels a request when the path resolver returns null', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint, params: { path: () => null } })

    expect(client.count()).toBe(false)
    expect(beacon).not.toHaveBeenCalled()
  })
})

describe('tracking helpers', () => {
  test('pageview always clears an instance event default', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint, params: { event: true } })

    client.pageview()

    expect(beaconUrl(beacon).searchParams.has('e')).toBe(false)
  })

  test('event sets the name and event marker', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint, params: { path: '/ignored' } })

    expect(client.event('signup', { noSession: true })).toBe(true)

    const query = beaconUrl(beacon).searchParams
    expect(query.get('p')).toBe('signup')
    expect(query.get('e')).toBe('true')
    expect(query.get('ns')).toBe('true')
    expect(() => client.event(' '.repeat(3))).toThrow(
      'event name must not be empty',
    )
  })
})

describe('filters and transport', () => {
  test('filters local addresses unless allowLocal is enabled', () => {
    setUrl('http://localhost:3000/docs')
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(init({ endpoint }).pageview()).toBe(false)
    expect(init({ endpoint, allowLocal: true }).pageview()).toBe(true)
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  test('filters private addresses', () => {
    setUrl('http://192.168.1.2/docs')
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(init({ endpoint }).pageview()).toBe(false)
    expect(beacon).not.toHaveBeenCalled()
  })

  test('filters frames unless allowFrame is enabled', () => {
    Object.defineProperty(globalThis, 'top', {
      configurable: true,
      value: {},
    })
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>

    expect(init({ endpoint }).pageview()).toBe(false)
    expect(init({ endpoint, allowFrame: true }).pageview()).toBe(true)
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  test('filters prerendered pages', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const client = init({ endpoint })

    setDocumentProperty('visibilityState', 'prerender')
    expect(client.pageview()).toBe(false)
    expect(beacon).not.toHaveBeenCalled()
  })

  test('runs a custom filter with resolved data', () => {
    const beacon = navigator.sendBeacon as ReturnType<typeof vi.fn>
    const filter = vi.fn(
      (context: GoatCounterFilterContext) =>
        !context.params.path.startsWith('/admin'),
    )
    const client = init({ endpoint, filter })

    expect(client.pageview({ path: '/admin' })).toBe(false)
    expect(filter).toHaveBeenCalledOnce()
    const context = filter.mock.calls[0]?.[0]
    expect(context?.params.path).toBe('/admin')
    expect(context?.endpoint.toString()).toContain('stats.example.com/count')
    expect(beacon).not.toHaveBeenCalled()
  })

  test('does not resolve parameters or run filters without Beacon', () => {
    const path = vi.fn((defaultPath: string) => defaultPath)
    const filter = vi.fn(() => true)
    setNavigatorProperty('sendBeacon', undefined)

    expect(init({ endpoint, params: { path }, filter }).pageview()).toBe(false)
    expect(path).not.toHaveBeenCalled()
    expect(filter).not.toHaveBeenCalled()
  })

  test('returns false when Beacon is unavailable, rejects, or throws', () => {
    const image = vi.fn()
    const fetch = vi.fn()
    vi.stubGlobal('Image', image)
    vi.stubGlobal('fetch', fetch)

    setNavigatorProperty('sendBeacon', undefined)
    expect(init({ endpoint }).pageview()).toBe(false)

    setNavigatorProperty(
      'sendBeacon',
      vi.fn(() => false),
    )
    expect(init({ endpoint }).pageview()).toBe(false)

    setNavigatorProperty(
      'sendBeacon',
      vi.fn(() => {
        throw new DOMException('blocked')
      }),
    )
    expect(init({ endpoint }).pageview()).toBe(false)
    expect(image).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
