import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '01-product', '02-architecture', '.wrangler', 'worker'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // `const { dropped: _dropped, ...kept } = x` is how we drop fields.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // ADR-002: the simulation core is pure and deterministic.
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['../ui/*', '../save/*', '../game/*', '*/ui/*', '*/save/*', '*/game/*'] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'performance'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng in src/sim/rng.ts' },
        { object: 'Date', property: 'now', message: 'The simulation has no wall clock' },
      ],
    },
  },
);
