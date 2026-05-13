import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'prodwilrijk oud/**',
      'public/sw.js',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'off',
      'react-hooks/capitalized-calls': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/void-use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/memo-dependencies': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/memoized-effect-dependencies': 'off',
      'react-hooks/exhaustive-effect-dependencies': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/no-deriving-state-in-effects': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/invariant': 'off',
      'react-hooks/todo': 'off',
      'react-hooks/syntax': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
      'react-hooks/rule-suppression': 'off',
      'react-hooks/fbt': 'off',
      'react-hooks/component-hook-factories': 'off',
    },
  },
]
