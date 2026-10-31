/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        setupFiles: ['__tests__/testSetup.test.ts'],
        testTimeout: 10000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.d.ts',
                'src/fakeData/**',
                'src/typeDefs/**'
            ],
            // Backend bar: measured ~68% lines / ~74% branches / ~87% functions.
            thresholds: {
                lines: 65,
                statements: 65,
                branches: 70,
                functions: 80
            }
        }
    }
})
