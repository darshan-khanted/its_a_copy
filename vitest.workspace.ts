import { defineWorkspace } from 'vitest/config';

// Non-watch test projects. Each project is selected via `vitest run --project <name>`.
// The `@/` alias and plugins are inherited from vite.config.ts via `extends`.
export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'unit',
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['src/**/*.property.test.{ts,tsx}'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'property',
      environment: 'node',
      include: ['src/**/*.property.test.{ts,tsx}'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'rules',
      environment: 'node',
      include: ['tests/rules/**/*.test.ts'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
    },
  },
]);
