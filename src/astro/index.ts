import type { GoatCounterData } from '../index.ts'
import type { AstroIntegration } from 'astro'

export interface AstroOptions {
  /** Full URL of the GoatCounter `/count` endpoint. */
  endpoint?: string
  /** Enable the client integration. @default true */
  enabled?: boolean
  /** Track the initial page and completed client navigations. @default true */
  autoPageviews?: boolean
  /** Include and track URL hash changes. @default false */
  hashMode?: boolean
  /** Allow tracking on local and private addresses. @default false */
  allowLocal?: boolean
  /** Allow tracking inside a frame. @default false */
  allowFrame?: boolean
  /** Serializable default GoatCounter parameters. */
  params?: Partial<GoatCounterData>
}

export type ResolvedAstroOptions = Required<AstroOptions>

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
