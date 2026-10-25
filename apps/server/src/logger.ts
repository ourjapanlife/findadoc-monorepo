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
