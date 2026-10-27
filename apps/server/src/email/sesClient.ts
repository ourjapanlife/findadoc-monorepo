import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { envVariables } from '../../utils/environmentVariables.js'
import { logger } from '../logger.js'

export type OutboundEmail = {
    to: string
    subject: string
    textBody: string
    bookingId?: string
}

function sesConfigured(): boolean {
    const from = envVariables.sesFromAddress()
    return typeof from === 'string' && from.length > 0
}

/**
 * Sends through SES when SES_FROM_ADDRESS is set.
 * Local and CI log the message instead so a missing identity never blocks a booking row.
 */
export async function sendTransactionalEmail(message: OutboundEmail): Promise<'sent' | 'logged'> {
    if (!sesConfigured()) {
        logger.info('Booking email logged (SES not configured)', {
            bookingId: message.bookingId,
            subject: message.subject,
            bodyLength: message.textBody.length
        })
        return 'logged'
    }

    const from = envVariables.sesFromAddress()!
    const client = new SESv2Client({
        region: envVariables.sesRegion(),
        // Dual-stack endpoint: the API VPC has no IPv4 NAT.
        endpoint: `https://email.${envVariables.sesRegion()}.api.aws`
    })

    const configurationSet = envVariables.sesConfigurationSet()
    await client.send(new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [message.to] },
        Content: {
            Simple: {
                Subject: { Data: message.subject, Charset: 'UTF-8' },
                Body: {
                    Text: { Data: message.textBody, Charset: 'UTF-8' }
                }
            }
        },
        ...(configurationSet ? { ConfigurationSetName: configurationSet } : {})
    }))

    return 'sent'
}
