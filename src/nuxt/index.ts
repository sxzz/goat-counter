import {
  addImports,
  addPlugin,
  createResolver,
  defineNuxtModule,
} from 'nuxt/kit'
import type {
  GoatCounterClient,
  GoatCounterIntegrationOptions,
  ResolvedGoatCounterIntegrationOptions,
} from '../index.ts'
import type { Nuxt, NuxtModule } from 'nuxt/schema'

export type ModuleOptions = GoatCounterIntegrationOptions
export type ResolvedModuleOptions = ResolvedGoatCounterIntegrationOptions

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

      nuxt.options.build.transpile.push(resolver.resolve('.'))

      addPlugin({
        src: resolver.resolve('./nuxt-plugin'),
        mode: 'client',
      })

      addImports({
        name: 'useGoatCounter',
        from: resolver.resolve('./use-goat-counter'),
      })
    },
  })

export default goatCounterModule
