import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Integration and E2E test configuration
    include: [
      'src/__tests__/integration/**/*.test.ts',
      'src/__tests__/e2e/**/*.test.ts'
    ],
    exclude: [
      'src/__tests__/unit/**/*.test.ts', // Exclude unit tests
      'node_modules/**/*'
    ],
    
    // Test environment
    environment: 'node',
    
    // Setup files
    setupFiles: ['src/__tests__/integration/test-setup.ts'],
    
    // Test timeouts for integration/E2E tests
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Coverage configuration for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage/integration',
      include: [
        'src/pages/api/**/*.ts',
        'src/services/**/*.ts',
        'src/lib/**/*.ts'
      ],
      exclude: [
        'src/__tests__/**/*',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'node_modules/**/*'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Test isolation
    isolate: true,
    
    // Reporting
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/integration-results.json'
    },
    
    // Global test configuration
    globals: true,
    
    // Retry configuration for flaky integration tests
    retry: 2,
    
    // Test sequence
    sequence: {
      concurrent: true,
      shuffle: false // Keep deterministic order for E2E workflows
    }
  },
  
  // Module resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  
  // Define globals for integration tests
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.TEST_TYPE': '"integration"'
  }
});