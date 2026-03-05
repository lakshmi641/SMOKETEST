/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['.next/', 'node_modules/', 'out/', '*.config.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|^React$',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/prop-types': 'off',
    'no-case-declarations': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react/no-unknown-property': ['warn', { ignore: ['jsx', 'global'] }],
    'no-useless-escape': 'warn',
    'no-useless-catch': 'warn',
    'no-self-assign': 'warn',
    'no-empty': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
  },
  overrides: [
    {
      files: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'e2e/**',
        'tests/**',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_|^React$',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'no-extra-semi': 'error',
      },
    },
  ],
};
