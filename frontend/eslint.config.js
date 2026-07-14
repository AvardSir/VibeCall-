import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/{App,main}.tsx', mode: 'file' },
        { type: 'feature', pattern: 'src/features/*', mode: 'folder' },
        { type: 'shared', pattern: 'src/shared/*', mode: 'folder' },
        { type: 'stores', pattern: 'src/stores/*', mode: 'folder' },
        { type: 'pages', pattern: 'src/pages/*', mode: 'file' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        rules: [
          { from: { type: 'app' }, allow: { to: { type: ['feature', 'shared', 'stores', 'pages'] } } },
          { from: { type: 'pages' }, allow: { to: { type: ['feature', 'shared', 'stores'] } } },
          { from: { type: 'feature' }, allow: { to: { type: ['shared', 'stores'] } } },
          { from: { type: 'shared' }, allow: { to: { type: 'shared' } } },
          { from: { type: 'stores' }, allow: { to: { type: 'shared' } } },
        ],
      }],
    },
  },
);
