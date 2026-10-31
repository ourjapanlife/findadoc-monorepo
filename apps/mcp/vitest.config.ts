/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        testTimeout: 10000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            // Backend bar (MCP): measured ~88% lines / ~76% branches / ~83% functions.
            thresholds: {
                lines: 80,
                statements: 80,
                branches: 70,
                functions: 75
            }
        }
    }
})
