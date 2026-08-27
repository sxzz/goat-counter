import { expect, test, vi } from 'vitest'
import { useGoatCounter } from '../src/runtime/use-goat-counter.ts'

const useNuxtApp = vi.hoisted(() => vi.fn())

vi.mock('nuxt/app', () => ({ useNuxtApp }))

test('returns undefined during SSR', () => {
  expect(typeof window).toBe('undefined')
  expect(useGoatCounter()).toBeUndefined()
  expect(useNuxtApp).not.toHaveBeenCalled()
})
