import { expect, test, vi } from 'vitest'

test('imports and initializes without browser globals or side effects', async () => {
  expect(typeof window).toBe('undefined')

  const { init } = await import('../src/index.ts')
  const path = vi.fn((defaultPath: string) => defaultPath)
  const filter = vi.fn(() => true)
  const client = init({
    endpoint: 'https://stats.example.com/count',
    params: { path },
    filter,
  })

  expect(client.count()).toBe(false)
  expect(client.pageview()).toBe(false)
  expect(client.event('signup')).toBe(false)
  expect(path).not.toHaveBeenCalled()
  expect(filter).not.toHaveBeenCalled()
})
