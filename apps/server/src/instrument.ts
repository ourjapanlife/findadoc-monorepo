// This file MUST be imported before any other module so Sentry can
// instrument node built-ins (http, etc.) before they are required.
import * as Sentry from '@sentry/node'
import { envVariables } from '../utils/environmentVariables.js'

const dsn = envVariables.sentryDsn()

/** Drops the request body, query string, and cookies from an event before it leaves. */
function withoutRequestData<T extends Sentry.Event>(event: T): T {
    if (event.request !== undefined) {
        delete event.request.data
        delete event.request.query_string
        delete event.request.cookies
    }
    return event
}

if (dsn) {
    Sentry.init({
        dsn,
        environment: envVariables.sentryEnvironment(),
        tracesSampleRate: envVariables.sentryTracesSampleRate(),
        sendDefaultPii: false,
        // A request body is a GraphQL document with its variables, and a query string can
        // carry the same. Neither goes to Sentry (#236).
        beforeSend: withoutRequestData,
        beforeSendTransaction: withoutRequestData
    })
    // eslint-disable-next-line no-console
    console.log('🛰️  Sentry initialized')
} else {
    // eslint-disable-next-line no-console
    console.log('🛰️  Sentry DSN not set — skipping Sentry initialization')
}
