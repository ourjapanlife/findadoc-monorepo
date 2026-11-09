import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { envVariables } from '../../utils/environmentVariables.js'
import { logger } from '../logger.js'
import { writeEmailPreview } from './emailPreview.js'

/**
 * An image shown inside the HTML part through `<img src="cid:{contentId}">`, not offered as a
 * download (online consult v2 §3.4: the PayPay QR). SES sends it with ContentDisposition INLINE.
 */
export type InlineAttachment = {
    contentId: string
    /** A generic name, such as paypay-qr.png. Never the stored object key. */
    fileName: string
    contentType: string
    content: Uint8Array
}

export type OutboundEmail = {
    to: string
    subject: string
    textBody: string
    /** Sent as the HTML part alongside the text part. */
    htmlBody?: string
    bookingId?: string
    inlineAttachments?: InlineAttachment[]
}

function sesConfigured(): boolean {
    const from = envVariables.sesFromAddress()
    return typeof from === 'string' && from.length > 0
}

/** What the local log says about attachments: how many and their types. Never names or keys. */
function attachmentSummary(message: OutboundEmail): { inlineAttachments: number, attachmentTypes: string[] } {
    const attachments = message.inlineAttachments ?? []
    return {
        inlineAttachments: attachments.length,
        attachmentTypes: attachments.map(attachment => attachment.contentType)
    }
}

async function logInsteadOfSending(message: OutboundEmail): Promise<'logged'> {
    // Outside production and tests, the HTML part and its images go to a gitignored folder so a
    // reviewer can open the email in a browser. The folder holds the message, so it never runs
    // on a deployed API.
    const previewPath = envVariables.isProduction() || envVariables.isTestingEnvironment()
        ? null
        : await writeEmailPreview(message).catch(() => null)
    logger.info('Booking email logged (SES not configured)', {
        bookingId: message.bookingId,
        subject: message.subject,
        bodyLength: message.textBody.length,
        ...attachmentSummary(message),
        // Local runs need the body to follow the patient cancel link. Production never logs it.
        ...(envVariables.isProduction() ? {} : { textBody: message.textBody }),
        ...(previewPath === null ? {} : { previewPath })
    })
    return 'logged'
}

/**
 * Sends through SES when SES_FROM_ADDRESS is set.
 * Local and CI log the message instead so a missing identity never blocks a booking row.
 */
export async function sendTransactionalEmail(message: OutboundEmail): Promise<'sent' | 'logged'> {
    const from = envVariables.sesFromAddress()
    if (!sesConfigured() || from === undefined) {
        return logInsteadOfSending(message)
    }

    const client = new SESv2Client({
        region: envVariables.sesRegion(),
        // Dual-stack endpoint: the API VPC has no IPv4 NAT.
        endpoint: `https://email.${envVariables.sesRegion()}.api.aws`
    })

    const configurationSet = envVariables.sesConfigurationSet()
    const attachments = message.inlineAttachments ?? []
    await client.send(new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [message.to] },
        Content: {
            Simple: {
                Subject: { Data: message.subject, Charset: 'UTF-8' },
                Body: {
                    Text: { Data: message.textBody, Charset: 'UTF-8' },
                    ...(message.htmlBody === undefined ? {} : { Html: { Data: message.htmlBody, Charset: 'UTF-8' } })
                },
                ...(attachments.length === 0
                    ? {}
                    : {
                        Attachments: attachments.map(attachment => ({
                            RawContent: attachment.content,
                            ContentDisposition: 'INLINE' as const,
                            ContentId: attachment.contentId,
                            FileName: attachment.fileName,
                            ContentType: attachment.contentType,
                            ContentTransferEncoding: 'BASE64' as const
                        }))
                    })
            }
        },
        ...(configurationSet ? { ConfigurationSetName: configurationSet } : {})
    }))

    return 'sent'
}
