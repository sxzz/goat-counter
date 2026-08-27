import goatCounter from '../../../src/nuxt.ts'
import type { NuxtConfig } from 'nuxt/schema'

const config: NuxtConfig = {
  modules: [goatCounter],
  goatCounter: {
    endpoint: 'https://stats.example.com/count',
    autoPageviews: false,
    allowFrame: true,
    params: {
      title: 'Nuxt fixture',
    },
  },
}

export default config
