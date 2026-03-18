import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test configuration
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        'scripts/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        'src/index.ts', // Entry point, mostly coordination
      ],
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Stricter thresholds for core domain logic
        'src/core/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },

    // Test patterns
    include: ['tests/**/*.test.{js,ts}'],
    exclude: ['node_modules/**', 'dist/**'],
    
    // Test environment
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Parallel testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});