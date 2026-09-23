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

const defaults = {
  endpoint: '',
  enabled: true,
  autoPageviews: true,
  hashMode: false,
  allowLocal: false,
  allowFrame: false,
  params: {},
} satisfies ResolvedAstroOptions

export function goatCounter(userOptions: AstroOptions = {}): AstroIntegration {
  const options = { ...defaults, ...userOptions }

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
