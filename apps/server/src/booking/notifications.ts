import { sendTransactionalEmail } from '../email/sesClient.js'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailFromUnknown(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined
    }
    const email = value.trim()
    return email !== '' && EMAIL_PATTERN.test(email) ? email : undefined
}

/**
 * Clinic inboxes for booking notices: the clinic's members only (#161).
 *
 * Directory contacts never opted in, so a clinic with no members gets no
 * notice. The request still shows in the dashboard and in moderation.
 */
export async function clinicNotifyAddresses(target: {
    facilityId: string | null
    clinicSiteId: string | null
}): Promise<string[]> {
    if (target.facilityId === null) {
        return []
    }
    const members = await db.selectFrom('clinic_memberships')
        .select('invited_email')
        .where('facility_id', '=', target.facilityId)
        .where('invited_email', 'is not', null)
        .execute()
    const memberEmails = members
        .map(row => emailFromUnknown(row.invited_email))
        .filter((email): email is string => email !== undefined)
    return [...new Set(memberEmails)]
}

/** Sends one notice. Returns false and logs instead of throwing. */
export async function sendBookingNotice(input: {
    to: string
    bookingId: string
    subject: string
    lines: string[]
}): Promise<boolean> {
    try {
        await sendTransactionalEmail({
            to: input.to,
            bookingId: input.bookingId,
            subject: input.subject,
            textBody: input.lines.join('\n')
        })
        return true
    } catch (error) {
        logger.error(`Booking notice failed for ${input.bookingId}: ${String(error)}`)
        return false
    }
}

/** Every clinic inbox except the patient's own address. */
export async function noticeClinic(input: {
    target: { facilityId: string | null, clinicSiteId: string | null }
    bookingId: string
    patientEmail?: string
    subject: string
    lines: string[]
}): Promise<void> {
    const patient = input.patientEmail?.toLowerCase()
    const addresses = (await clinicNotifyAddresses(input.target))
        .filter(address => address.toLowerCase() !== patient)
    for (const address of addresses) {
        await sendBookingNotice({ to: address, bookingId: input.bookingId, subject: input.subject, lines: input.lines })
    }
}
