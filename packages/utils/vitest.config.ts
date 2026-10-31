import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
            // Shared package bar: measured ~54% lines / ~67% branches / ~33% functions
            // (string.ts and object.ts still need unit tests).
            thresholds: {
                lines: 50,
                statements: 50,
                branches: 60,
                functions: 30
            }
        }
    }
})
