import { lib } from 'tsdown-preset-sxzz'

export default lib(
  { entry: 'all' },
  {
    deps: { neverBundle: true },
    target: 'baseline-widely-available',
  },
)
