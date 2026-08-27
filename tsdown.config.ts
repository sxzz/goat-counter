import { lib } from 'tsdown-preset-sxzz'

export default lib(
  {
    entry: {
      index: 'src/index.ts',
      nuxt: 'src/nuxt.ts',
      'runtime/nuxt-plugin': 'src/runtime/nuxt-plugin.ts',
      'runtime/use-goat-counter': 'src/runtime/use-goat-counter.ts',
    },
  },
  {
    deps: {
      neverBundle: true,
    },
    target: 'baseline-widely-available',
  },
)
