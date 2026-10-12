import type {
  GoatCounterIntegrationOptions,
  ResolvedGoatCounterIntegrationOptions,
} from '../index.ts'
import type { AstroIntegration } from 'astro'

export type AstroOptions = GoatCounterIntegrationOptions
export type ResolvedAstroOptions = ResolvedGoatCounterIntegrationOptions

export function goatCounter(userOptions: AstroOptions = {}): AstroIntegration {
  const options: ResolvedAstroOptions = {
    endpoint: userOptions.endpoint ?? '',
    enabled: userOptions.enabled ?? true,
    autoPageviews: userOptions.autoPageviews ?? true,
    hashMode: userOptions.hashMode ?? false,
    allowLocal: userOptions.allowLocal ?? false,
    allowFrame: userOptions.allowFrame ?? false,
    params: userOptions.params ?? {},
  }

  return {
    name: 'goat-counter',
    hooks: {
      'astro:config:setup': ({ injectScript }) => {
        injectScript(
          'page',
          `
            import { initAstroClient } from 'goat-counter/astro/runtime';

            initAstroClient(${JSON.stringify(options)});
          `,
        )
      },
    },
  }
}
