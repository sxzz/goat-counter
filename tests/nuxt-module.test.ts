import { fileURLToPath } from 'node:url'
import { loadNuxt } from '@nuxt/kit'
import { expect, test } from 'vitest'

const rootDir = fileURLToPath(new URL('fixtures/basic', import.meta.url))
const buildDir = fileURLToPath(
  new URL('../node_modules/.cache/goat-counter-nuxt-test', import.meta.url),
)

test('registers the Nuxt client integration and public runtime config', async () => {
  const nuxt = await loadNuxt({
    cwd: rootDir,
    dev: false,
    ready: true,
    overrides: { buildDir },
  })

  try {
    expect(nuxt.options.runtimeConfig.public.goatCounter).toEqual({
      endpoint: 'https://stats.example.com/count',
      enabled: true,
      autoPageviews: false,
      hashMode: false,
      allowLocal: false,
      allowFrame: true,
      params: { title: 'Nuxt fixture' },
    })

    const plugin = nuxt.options.plugins.find(
      (entry: string | { mode?: string; src: string }) => {
        const source = typeof entry === 'string' ? entry : entry.src
        return source.includes('nuxt-plugin')
      },
    )
    expect(plugin).toBeDefined()
    expect(typeof plugin === 'string' ? undefined : plugin?.mode).toBe('client')
    const imports: Array<{ from: string; name: string }> = []
    await nuxt.callHook('imports:extend', imports)
    expect(imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'useGoatCounter' }),
      ]),
    )
  } finally {
    await nuxt.close()
  }
}, 30_000)
