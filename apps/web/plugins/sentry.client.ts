import * as Sentry from '@sentry/vue'
import { defineNuxtPlugin, useRuntimeConfig, useRouter } from '#app'

function withoutUrlFragment(url: string): string {
    const hashAt = url.indexOf('#')
    return hashAt === -1 ? url : url.slice(0, hashAt)
}

export default defineNuxtPlugin(nuxtApp => {
    const sentryConfig = useRuntimeConfig().public.sentry as {
        dsn?: string
        environment?: string
        tracesSampleRate?: string
    }

    if (!sentryConfig.dsn) {
        // eslint-disable-next-line no-console
        console.log('🛰️ Sentry DSN not set — skipping Sentry initialization')
        return
    }

    const parsedSampleRate = sentryConfig.tracesSampleRate
        ? Number(sentryConfig.tracesSampleRate)
        : NaN
    const tracesSampleRate = Number.isFinite(parsedSampleRate)
        ? parsedSampleRate
        : (import.meta.dev ? 1.0 : 0.1)

    Sentry.init({
        app: nuxtApp.vueApp,
        dsn: sentryConfig.dsn,
        environment: sentryConfig.environment
          ?? (import.meta.dev ? 'development' : 'production'),
        integrations: [
            Sentry.browserTracingIntegration({ router: useRouter() })
        ],
        tracesSampleRate,
        sendDefaultPii: false,
        // /book/manage carries the patient's cancel token in the hash.
        beforeSend: event => {
            if (event.request?.url !== undefined) {
                event.request.url = withoutUrlFragment(event.request.url)
            }
            return event
        },
        beforeSendTransaction: event => {
            if (event.request?.url !== undefined) {
                event.request.url = withoutUrlFragment(event.request.url)
            }
            return event
        },
        beforeBreadcrumb: breadcrumb => {
            const data = breadcrumb.data
            if (data !== undefined) {
                for (const key of ['from', 'to', 'url']) {
                    if (typeof data[key] === 'string') {
                        data[key] = withoutUrlFragment(data[key])
                    }
                }
            }
            return breadcrumb
        }
    })
    // eslint-disable-next-line no-console
    console.log('🛰️ Sentry initialized')
})
