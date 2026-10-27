import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
    test: {
        globals: true,
        setupFiles: './tests/setup.ts',
        environment: 'nuxt',
        environmentOptions: {
            nuxt: { domEnvironment: 'jsdom' }
        },
        include: ['tests/vitest/unit/**/*.spec.ts', 'tests/vitest/piniaTests/**/*.spec.ts'],
        exclude: ['node_modules'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'html'],
            reportsDirectory: './coverage',
            // Unit surface: helpers, composables, and Pinia stores.
            include: [
                'utils/**/*.{ts,vue}',
                'composables/**/*.{ts,vue}',
                'stores/**/*.{ts,vue}'
            ],
            exclude: [
                '**/*.{spec,test}.ts',
                '**/node_modules/**',
                '**/.nuxt/**'
            ],
            // Frontend bar (below backend): measured ~55% lines / ~51% branches / ~58% functions.
            thresholds: {
                lines: 50,
                statements: 50,
                branches: 45,
                functions: 50
            }
        }
    }
})
