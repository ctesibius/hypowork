import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  {
    ignores: [
      '**/.pnpm-store/**',
      '**/*.spec.*',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.contentlayer/**',
      '**/public/**',
      '**/*.config.*',
      '**/*.d.ts',
      '.changeset/**',
      'tooling/**',
    ],
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: ['**/src/**/*.tsx', '**/src/**/use*.ts'],
    languageOptions: { parser: tsParser },
  },
  {
    files: ['**/src/**/*.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
]);
