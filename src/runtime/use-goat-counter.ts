import { useNuxtApp } from 'nuxt/app'
import type { GoatCounterClient } from '../index.ts'

export function useGoatCounter(): GoatCounterClient | undefined {
  return import.meta.client ? useNuxtApp().$goatCounter : undefined
}
