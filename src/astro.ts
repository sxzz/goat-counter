import type { ModuleOptions } from './nuxt.ts'
import type { AstroIntegration } from 'astro'

const defaults = {
  endpoint: '',
  enabled: true,
  autoPageviews: true,
  hashMode: false,
  allowLocal: false,
  allowFrame: false,
  params: {},
} as const

export function goatCounter(userOptions: ModuleOptions = {}): AstroIntegration {
  const options = { ...defaults, ...userOptions }

  return {
    name: 'goat-counter',
    hooks: {
      'astro:config:setup': ({ injectScript, updateConfig }) => {
        updateConfig({
          vite: {
            define: {
              __GOAT_COUNTER_OPTIONS__: JSON.stringify(options),
            },
          },
        })

        injectScript(
          'page',
          `import { initAstroClient } from "goat-counter/runtime/astro-client"; initAstroClient();`,
        )
      },
    },
  }
}
