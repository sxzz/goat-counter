import {
  addImports,
  addPlugin,
  createResolver,
  defineNuxtModule,
} from 'nuxt/kit'
import type { GoatCounterClient, GoatCounterData } from './index.ts'
import type { Nuxt, NuxtModule } from 'nuxt/schema'

export interface ModuleOptions {
  /** Full URL of the GoatCounter `/count` endpoint. */
  endpoint?: string
  /** Enable the client integration. @default true */
  enabled?: boolean
  /** Track the initial page and successful client navigations. @default true */
  autoPageviews?: boolean
  /** Include URL hashes in automatically tracked paths. @default false */
  hashMode?: boolean
  /** Allow tracking on local and private addresses. @default false */
  allowLocal?: boolean
  /** Allow tracking when the application runs inside a frame. @default false */
  allowFrame?: boolean
  /** Serializable default GoatCounter parameters. */
  params?: Partial<GoatCounterData>
}

export interface ResolvedModuleOptions {
  endpoint: string
  enabled: boolean
  autoPageviews: boolean
  hashMode: boolean
  allowLocal: boolean
  allowFrame: boolean
  params: Partial<GoatCounterData>
}

declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    goatCounter: ResolvedModuleOptions
  }

  interface NuxtConfig {
    goatCounter?: ModuleOptions
  }

  interface NuxtOptions {
    goatCounter: ModuleOptions
  }
}

declare module 'nuxt/app' {
  interface NuxtApp {
    $goatCounter?: GoatCounterClient
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $goatCounter?: GoatCounterClient
  }
}

const defaults = {
  endpoint: '',
  enabled: true,
  autoPageviews: true,
  hashMode: false,
  allowLocal: false,
  allowFrame: false,
  params: {},
} satisfies ResolvedModuleOptions

const goatCounterModule: NuxtModule<ModuleOptions, ModuleOptions, false> =
  defineNuxtModule<ModuleOptions>({
    meta: {
      name: 'goat-counter',
      configKey: 'goatCounter',
      compatibility: { nuxt: '^4.0.0' },
    },
    defaults,
    setup(options: ModuleOptions, nuxt: Nuxt): void {
      const resolver = createResolver(import.meta.url)
      const existing = (nuxt.options.runtimeConfig.public.goatCounter ?? {}) as
        Partial<ResolvedModuleOptions> | undefined

      nuxt.options.runtimeConfig.public.goatCounter = {
        ...defaults,
        ...options,
        ...existing,
        params: {
          ...defaults.params,
          ...options.params,
          ...existing?.params,
        },
      }

      nuxt.options.build.transpile.push(resolver.resolve('./runtime'))

      addPlugin({
        src: resolver.resolve('./runtime/nuxt-plugin'),
        mode: 'client',
      })

      addImports({
        name: 'useGoatCounter',
        from: resolver.resolve('./runtime/use-goat-counter'),
      })
    },
  })

export default goatCounterModule
