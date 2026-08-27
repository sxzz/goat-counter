# goat-counter

[![Open on npmx][npmx-version-src]][npmx-href]
[![npm downloads][npmx-downloads-src]][npmx-href]
[![Unit Test][unit-test-src]][unit-test-href]

A typed, dependency-free GoatCounter client for modern browsers. It sends
requests directly to GoatCounter's `/count` endpoint and never loads
`count.js`.

- ESM-only with first-class TypeScript types
- No import-time or initialization side effects
- Pageview and event helpers
- Typed overrides for supported GoatCounter request parameters
- Optional Nuxt 4 module with automatic pageview tracking

## Install

```bash
npm install goat-counter
```

## Browser usage

Importing the package and calling `init()` do not send anything. A request is
only queued after calling `count()`, `pageview()`, or `event()`.

```ts
import { init } from 'goat-counter'

const goatCounter = init({
  endpoint: 'https://example.goatcounter.com/count',
  params: {
    path: path => path.replace(/^\/en/, ''),
  },
  filter: ({ params }) => !params.path.startsWith('/admin'),
})

goatCounter.pageview()
goatCounter.event('signup', { title: 'Created an account' })
```

All tracking methods return `true` only when `navigator.sendBeacon()` accepts
the request. Filtered, cancelled, disabled, unsupported, and rejected requests
return `false`. The SDK deliberately does not fall back to `fetch()` or an
image request.

The package is safe to import and initialize in DOM-less environments such as
SSR. Tracking methods return `false` there without reading browser defaults or
running parameter resolvers and filters.

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `endpoint` | `string \| URL` | required | Full GoatCounter `/count` endpoint URL. |
| `enabled` | `boolean` | `true` | Disable every request from this client. |
| `allowLocal` | `boolean` | `false` | Allow local and private network addresses. |
| `allowFrame` | `boolean` | `false` | Allow tracking from a frame or iframe. |
| `params` | `GoatCounterParams` | `{}` | Default request parameter overrides. |
| `filter` | `(context) => boolean` | — | Return `true` to send the resolved request. |

Built-in filtering skips prerendered pages, frames unless `allowFrame` is
enabled, and local or private addresses unless `allowLocal` is enabled. A
custom `filter` runs afterward with the resolved endpoint and parameters.

### Parameters

Every supported parameter can be overridden with a value or a synchronous
resolver:

| SDK field | GoatCounter field | Browser default |
| --- | --- | --- |
| `path` | `p` | Same-host canonical path, or `location.pathname + location.search` |
| `title` | `t` | `document.title` |
| `referrer` | `r` | `document.referrer` |
| `event` | `e` | `false` |
| `noSession` | `ns` | `false` |
| `screen` | `s` | Screen width |
| `query` | `q` | `location.search` |
| `bot` | `b` | `153` for WebDriver, otherwise `0` |

Per-call overrides take precedence over `init()` defaults. Resolver functions
receive the browser-derived default value. Returning `null` from the `path`
resolver cancels the request; returning `null` for another parameter omits that
parameter.

```ts
goatCounter.count({ path: '/virtual-page' })
goatCounter.pageview({ referrer: () => 'newsletter' })
goatCounter.event('download', { noSession: true })
```

## Nuxt 4

Add the dedicated module export to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['goat-counter/nuxt'],
  goatCounter: {
    endpoint: 'https://example.goatcounter.com/count',
  },
})
```

The module tracks the initial page and successful client-side navigations by
default. Disable that behavior with `autoPageviews: false`:

```ts
export default defineNuxtConfig({
  modules: ['goat-counter/nuxt'],
  goatCounter: {
    endpoint: 'https://example.goatcounter.com/count',
    autoPageviews: false,
    hashMode: false,
    allowLocal: false,
    allowFrame: false,
    params: { title: 'My site' },
  },
})
```

`endpoint`, `enabled`, `autoPageviews`, `hashMode`, `allowLocal`, `allowFrame`,
and static `params` are available under `runtimeConfig.public.goatCounter`.
For example, the endpoint can be provided with
`NUXT_PUBLIC_GOAT_COUNTER_ENDPOINT`.

Use the auto-imported composable for manual pageviews and events:

```ts
const goatCounter = useGoatCounter()

goatCounter?.pageview({ path: '/virtual-page' })
goatCounter?.event('signup')
```

The composable returns `undefined` during SSR. Nuxt module `params` must be
serializable static values; per-call parameters can still use resolver
functions.

## Compatibility

The distributed code targets Baseline Widely Available browsers: Chrome and
Edge 111+, Firefox 114+, and Safari/iOS 16.4+. The Nuxt integration supports
Nuxt 4 only.

This project is an unofficial GoatCounter client. Refer to the
[GoatCounter JavaScript API](https://www.goatcounter.com/help/js) for the
upstream tracking semantics.

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2026-PRESENT [Kevin Deng](https://github.com/sxzz)

<!-- Badges -->

[npmx-version-src]: https://npmx.dev/api/registry/badge/version/goat-counter
[npmx-downloads-src]: https://npmx.dev/api/registry/badge/downloads-month/goat-counter
[npmx-href]: https://npmx.dev/goat-counter
[unit-test-src]: https://github.com/sxzz/goat-counter/actions/workflows/unit-test.yml/badge.svg
[unit-test-href]: https://github.com/sxzz/goat-counter/actions/workflows/unit-test.yml
