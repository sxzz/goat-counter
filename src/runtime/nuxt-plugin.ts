import {
  defineNuxtPlugin,
  useRouter,
  useRuntimeConfig,
  type Plugin,
} from 'nuxt/app'
import {
  init,
  type GoatCounterClient,
  type GoatCounterPageviewParams,
} from '../index.ts'
import type { ResolvedModuleOptions } from '../nuxt.ts'

function withoutHash(path: string): string {
  return path.split('#', 1)[0] || '/'
}

function schedule(callback: () => void): void {
  queueMicrotask(() => requestAnimationFrame(callback))
}

const goatCounterPlugin: Plugin<{ goatCounter: GoatCounterClient }> =
  defineNuxtPlugin<{ goatCounter: GoatCounterClient }>({
    name: 'goat-counter',
    setup(nuxtApp) {
      const options = useRuntimeConfig().public
        .goatCounter as ResolvedModuleOptions

      if (!options.enabled) return

      const { endpoint } = options
      if (!endpoint) {
        console.warn(
          '[goat-counter] Tracking is enabled but no endpoint is configured.',
        )
        return
      }

      let goatCounter
      try {
        goatCounter = init({
          endpoint,
          allowLocal: options.allowLocal,
          allowFrame: options.allowFrame,
          params: options.params,
        })
      } catch (error) {
        console.warn(
          '[goat-counter] Invalid endpoint; tracking is disabled.',
          error,
        )
        return
      }

      if (options.autoPageviews) {
        const router = useRouter()
        const hashMode = options.hashMode
        const hasConfiguredPath = Object.prototype.hasOwnProperty.call(
          options.params,
          'path',
        )
        let observedInitialNavigation = false

        const trackRoute = (fullPath: string): void => {
          const params: GoatCounterPageviewParams | undefined =
            hasConfiguredPath
              ? undefined
              : { path: hashMode ? fullPath : withoutHash(fullPath) }
          goatCounter.pageview(params)
        }

        router.afterEach((to, from, failure) => {
          if (failure) return
          if (
            !hashMode &&
            withoutHash(to.fullPath) === withoutHash(from.fullPath)
          ) {
            return
          }

          observedInitialNavigation = true
          schedule(() => trackRoute(to.fullPath))
        })

        nuxtApp.hook('app:mounted', () => {
          if (!observedInitialNavigation) {
            trackRoute(router.currentRoute.value.fullPath)
          }
        })
      }

      return {
        provide: {
          goatCounter,
        },
      }
    },
  })

// eslint-disable-next-line import/no-default-export
export default goatCounterPlugin
