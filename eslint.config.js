import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', '.wrangler', 'node_modules', 'worker-configuration.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // The shared rules must stay deterministic: forbid unseeded randomness and
    // transcendental Math functions whose results may differ across engines.
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['random', 'sin', 'cos', 'tan', 'atan', 'atan2', 'exp', 'log', 'pow', 'asin', 'acos'].map((p) => ({
          object: 'Math',
          property: p,
          message: 'Shared rules must be deterministic: use +,-,*,/,sqrt and explicit rounding only.',
        })),
      ],
    },
  },
);
