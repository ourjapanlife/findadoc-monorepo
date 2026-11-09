import { createLogger, transports, format, Logger } from 'winston'
import { envVariables } from '../utils/environmentVariables.js'

export let logger: Logger

/**
 * One JSON object per line on stdout. CloudWatch Logs Insights reads these fields
 * directly, for example `filter type = 'graphql' | stats avg(durationMs) by operationName`.
 */
export const productionFormat = format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
)

const localFormat = format.combine(format.simple(), format.colorize())

export const initializeLogger = () => {
    // eslint-disable-next-line no-console
    console.log('🔊 Initializing logger...')

    if (logger) {
        return
    }

    const isProduction = envVariables.isProduction()

    logger = createLogger({
        level: envVariables.logLevel() ?? (isProduction ? 'info' : 'debug'),
        transports: [
            new transports.Console({
                format: isProduction ? productionFormat : localFormat
            })
        ]
    })
}

export type ErrorLogFields = { errorName: string, errorCode?: string }

/**
 * The parts of an error that are safe to log (#236): its class name, and the SQLSTATE or
 * AWS error code when it has one. Never the message or the stack: a database error can
 * repeat the value that failed ("invalid input syntax for type uuid: ..."), and an SES or
 * S3 error can repeat an email address or an object key.
 */
export function errorLogFields(error: unknown): ErrorLogFields {
    if (!(error instanceof Error)) {
        return { errorName: 'unknown' }
    }
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/u.test(code)
        ? { errorName: error.name, errorCode: code }
        : { errorName: error.name }
}
