import js              from '@eslint/js';
import globals         from 'globals';
import react           from 'eslint-plugin-react';
import reactHooks      from 'eslint-plugin-react-hooks';
import reactRefresh    from 'eslint-plugin-react-refresh';

/**
 * Flat-config ESLint setup for BPFL frontend.
 *
 * Philosophy: catch BUGS and STYLE drift, don't bikeshed formatting.
 * No prettier/spacing rules (they argue with humans + don't catch defects);
 * just the React / hooks / unused-imports rules that have caught real
 * regressions in this codebase before.
 */
export default [
  // Don't lint build output / vendor / generated files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.vite/**',
      'public/**',
    ],
  },

  // Base JS recommendations
  js.configs.recommended,

  // App source: JSX/React
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType:  'module',
      globals:     { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks':  reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // React-specific
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope':  'off',   // not needed with the new JSX transform
      'react/prop-types':          'off',   // we don't use prop-types; TS would be the long-term fix
      'react/no-unescaped-entities': 'off', // Bulgarian content has lots of ' / "
      'react/display-name':        'off',

      // Hooks — catch the most common mistakes
      'react-hooks/rules-of-hooks':   'error',
      'react-hooks/exhaustive-deps':  'warn',

      // Fast-refresh: warns when a file mixes a component with non-component exports
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // General correctness — bugs, not style
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-undef':                 'error',
      'no-empty':                 ['error', { allowEmptyCatch: true }],
      'no-constant-condition':    ['error', { checkLoops: false }],
      'no-irregular-whitespace':  'error',
      'no-prototype-builtins':    'off',
      'no-async-promise-executor':'error',
    },
  },

  // Config files run in Node, not the browser
  {
    files: ['*.config.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
