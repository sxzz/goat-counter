export interface GoatCounterScreen {
  width: number
  height?: number
  pixelRatio?: number
}

export interface GoatCounterData {
  path: string
  title: string
  referrer: string
  event: boolean
  noSession: boolean
  screen: GoatCounterScreen
  query: string
  bot: number
}

export type GoatCounterParam<T> = T | ((defaultValue: T) => T | null)

export type GoatCounterParams = {
  [K in keyof GoatCounterData]?: GoatCounterParam<GoatCounterData[K]>
}

export interface GoatCounterFilterContext {
  endpoint: URL
  params: Partial<GoatCounterData> & { path: string }
}

export interface GoatCounterOptions {
  endpoint: string | URL
  enabled?: boolean
  allowLocal?: boolean
  allowFrame?: boolean
  params?: GoatCounterParams
  filter?: (context: GoatCounterFilterContext) => boolean
}

export type GoatCounterPageviewParams = Omit<GoatCounterParams, 'event'>
export type GoatCounterEventParams = Omit<GoatCounterParams, 'event' | 'path'>

export interface GoatCounterClient {
  count: (params?: GoatCounterParams) => boolean
  pageview: (params?: GoatCounterPageviewParams) => boolean
  event: (name: string, params?: GoatCounterEventParams) => boolean
}

interface ClientState {
  endpoint: URL
  enabled: boolean
  allowLocal: boolean
  allowFrame: boolean
  params: GoatCounterParams
  filter?: (context: GoatCounterFilterContext) => boolean
}

const parameterNames = {
  path: 'p',
  title: 't',
  referrer: 'r',
  event: 'e',
  noSession: 'ns',
  screen: 's',
  query: 'q',
  bot: 'b',
} as const satisfies Record<keyof GoatCounterData, string>

const parameterKeys = Object.keys(parameterNames) as Array<
  keyof GoatCounterData
>

function normalizeEndpoint(endpoint: string | URL): URL {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new TypeError('GoatCounter endpoint must be an absolute URL')
  }
  return url
}

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof navigator !== 'undefined'
  )
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function getDefaultPath(): string {
  let url = new URL(location.href)
  const canonical = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"][href]',
  )

  if (canonical) {
    const canonicalUrl = new URL(canonical.href, location.href)
    if (
      normalizeHostname(canonicalUrl.hostname) ===
      normalizeHostname(location.hostname)
    ) {
      url = canonicalUrl
    }
  }

  return `${url.pathname}${url.search}` || '/'
}

function getBrowserDefaults(): GoatCounterData {
  return {
    path: getDefaultPath(),
    title: document.title,
    referrer: document.referrer,
    event: false,
    noSession: false,
    screen: { width: window.screen.width },
    query: location.search,
    bot: Reflect.get(navigator, 'webdriver') === true ? 153 : 0,
  }
}

function resolveParam<Key extends keyof GoatCounterData>(
  key: Key,
  defaults: GoatCounterData,
  initial: GoatCounterParams,
  overrides: GoatCounterParams,
): GoatCounterData[Key] | undefined {
  const override = overrides[key] ?? initial[key]
  const defaultValue = defaults[key]

  if (typeof override === 'function') {
    return (
      override as (
        value: GoatCounterData[Key],
      ) => GoatCounterData[Key] | undefined
    )(defaultValue)
  }

  return (override ?? defaultValue) as GoatCounterData[Key]
}

function resolveParams(
  defaults: GoatCounterData,
  initial: GoatCounterParams,
  overrides: GoatCounterParams,
): Partial<GoatCounterData> {
  return {
    path: resolveParam('path', defaults, initial, overrides),
    title: resolveParam('title', defaults, initial, overrides),
    referrer: resolveParam('referrer', defaults, initial, overrides),
    event: resolveParam('event', defaults, initial, overrides),
    noSession: resolveParam('noSession', defaults, initial, overrides),
    screen: resolveParam('screen', defaults, initial, overrides),
    query: resolveParam('query', defaults, initial, overrides),
    bot: resolveParam('bot', defaults, initial, overrides),
  }
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replaceAll(/^\[|\]$/g, '')

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return true
  }

  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) {
    return true
  }

  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some(Number.isNaN)) return false

  const [first = -1, second = -1] = octets
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function passesBuiltInFilters(state: ClientState): boolean {
  if ((document.visibilityState as string) === 'prerender') return false
  if (!state.allowFrame && !Object.is(globalThis, top)) return false
  if (
    !state.allowLocal &&
    (location.protocol === 'file:' || isLocalHostname(location.hostname))
  ) {
    return false
  }
  return true
}

function serializeScreen(screen: GoatCounterScreen): string {
  const values = [screen.width]
  if (screen.height !== undefined) values.push(screen.height)
  if (screen.pixelRatio !== undefined) values.push(screen.pixelRatio)
  return values.join(',')
}

function serializeValue(
  key: keyof GoatCounterData,
  value: GoatCounterData[keyof GoatCounterData] | undefined,
): string | null {
  if (value === null || value === '' || value === false) return null
  if (key === 'screen') return serializeScreen(value as GoatCounterScreen)
  return String(value)
}

function createCountUrl(endpoint: URL, data: Partial<GoatCounterData>): URL {
  const url = new URL(endpoint)

  for (const key of parameterKeys) {
    const name = parameterNames[key]
    url.searchParams.delete(name)

    const value = serializeValue(key, data[key])
    if (value !== null) url.searchParams.set(name, value)
  }

  return url
}

function send(state: ClientState, overrides: GoatCounterParams = {}): boolean {
  if (!state.enabled || !isBrowser() || !passesBuiltInFilters(state)) {
    return false
  }
  if (typeof navigator.sendBeacon !== 'function') return false

  const params = resolveParams(getBrowserDefaults(), state.params, overrides)
  if (params.path == null) return false

  if (
    state.filter &&
    !state.filter({
      endpoint: new URL(state.endpoint),
      params: params as GoatCounterFilterContext['params'],
    })
  ) {
    return false
  }

  try {
    return navigator.sendBeacon(createCountUrl(state.endpoint, params).href)
  } catch {
    return false
  }
}

export function init(options: GoatCounterOptions): GoatCounterClient {
  const state: ClientState = {
    endpoint: normalizeEndpoint(options.endpoint),
    enabled: options.enabled ?? true,
    allowLocal: options.allowLocal ?? false,
    allowFrame: options.allowFrame ?? false,
    params: { ...options.params },
    filter: options.filter,
  }

  return {
    count(params?: GoatCounterParams): boolean {
      return send(state, params)
    },
    pageview(params?: GoatCounterPageviewParams): boolean {
      return send(state, { ...params, event: false })
    },
    event(name: string, params?: GoatCounterEventParams): boolean {
      if (name.trim() === '') {
        throw new TypeError('GoatCounter event name must not be empty')
      }

      return send(state, { ...params, path: name, event: true })
    },
  }
}
