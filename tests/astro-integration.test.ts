import { expect, test, vi } from 'vitest'
import { goatCounter, type AstroOptions } from '../src/astro/index.ts'
import type { AstroIntegration } from 'astro'

type SetupOptions = Parameters<
  NonNullable<AstroIntegration['hooks']['astro:config:setup']>
>[0]

test.each<AstroOptions>([
  {},
  {
    endpoint: undefined,
    enabled: undefined,
    autoPageviews: undefined,
    hashMode: undefined,
    allowLocal: undefined,
    allowFrame: undefined,
    params: undefined,
  },
  {
    endpoint: 'https://stats.example.com/count',
    params: undefined,
    enabled: undefined,
  },
])('applies defaults to missing or undefined options: %j', async (options) => {
  const integration = goatCounter(options)
  const injectScript = vi.fn<SetupOptions['injectScript']>()
  await integration.hooks['astro:config:setup']?.({
    injectScript,
  } as unknown as SetupOptions)

  expect(injectScript).toHaveBeenCalledTimes(1)
  const [stage, script] = injectScript.mock.calls[0] as [string, string]
  expect(stage).toBe('page')
  expect(script).toContain("from 'goat-counter/astro/runtime'")
  const serialized = script.match(/initAstroClient\((.*)\);/)?.[1]
  expect(serialized).toBeDefined()
  expect(JSON.parse(serialized!)).toEqual({
    endpoint: options.endpoint ?? '',
    enabled: true,
    autoPageviews: true,
    hashMode: false,
    allowLocal: false,
    allowFrame: false,
    params: {},
  })
})

test('preserves explicit options when generating the client script', async () => {
  const options: Required<AstroOptions> = {
    endpoint: 'https://stats.example.com/count',
    enabled: false,
    autoPageviews: false,
    hashMode: true,
    allowLocal: true,
    allowFrame: true,
    params: { path: '/custom', title: 'A "quoted" title' },
  }
  const injectScript = vi.fn<SetupOptions['injectScript']>()
  await goatCounter(options).hooks['astro:config:setup']?.({
    injectScript,
  } as unknown as SetupOptions)
  const script = injectScript.mock.calls[0]?.[1] as string
  const serialized = script.match(/initAstroClient\((.*)\);/)?.[1]
  expect(serialized).toBeDefined()
  expect(JSON.parse(serialized!)).toEqual(options)
})
