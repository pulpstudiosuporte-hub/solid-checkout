import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const typed = tseslint.configs.recommendedTypeChecked.map(config => ({ ...config, files: ['**/*.ts', '**/*.tsx'] }));
const accessibilityWarnings = Object.fromEntries(Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, config]) => {
  const [severity, ...options] = Array.isArray(config) ? config : [config];
  return [rule, [severity === 'off' || severity === 0 ? 'off' : 'warn', ...options]];
}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.shopify/**', '.visual-check/**', 'apps/web/public/**', 'extensions/**/assets/**', 'scripts/*.mjs', 'eslint.config.js'] },
  { files: ['**/*.js', '**/*.jsx'], ...js.configs.recommended },
  {
    files: ['apps/web/src/**/*.{js,jsx}', 'apps/web/test/**/*.{js,jsx}', 'solid-site/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, __SOLID_BUILD_VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...accessibilityWarnings,
      // The deprecated rule duplicates label-has-associated-control and reports false positives.
      'jsx-a11y/label-has-for': 'off',
      'jsx-a11y/label-has-associated-control': ['warn', { assert: 'either', depth: 3 }],
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/iframe-has-title': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['solid-site/*.js'], languageOptions: { globals: globals.node } },
  ...typed,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
