const path = require('path');

module.exports = [
  {
    files: ['src/**'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      react: require('eslint-plugin-react'),
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin')
    },
    ignores: ['dist/**', 'node_modules/**', 'public/manifest.json'],
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'no-unused-vars': 'warn'
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    }
  }
];
