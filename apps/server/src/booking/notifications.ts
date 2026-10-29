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
 * Clinic inboxes for booking notices.
 *
 * Members of the clinic come first: they asked for booking access. Until a
 * clinic has members, fall back to the clinic page doctors, the facility
 * contact email, and the professionals linked to the facility.
 */
export async function clinicNotifyAddresses(target: {
    facilityId: string | null
    clinicSiteId: string | null
}): Promise<string[]> {
    if (target.facilityId !== null) {
        const members = await db.selectFrom('clinic_memberships')
            .select('invited_email')
            .where('facility_id', '=', target.facilityId)
            .where('invited_email', 'is not', null)
            .execute()
        const memberEmails = members
            .map(row => emailFromUnknown(row.invited_email))
            .filter((email): email is string => email !== undefined)
        if (memberEmails.length > 0) {
            return [...new Set(memberEmails)]
        }
    }

    const addresses = new Set<string>()

    if (target.clinicSiteId !== null) {
        const doctors = await db.selectFrom('clinic_site_doctors')
            .innerJoin('hps', 'hps.id', 'clinic_site_doctors.hp_id')
            .select('hps.email')
            .where('clinic_site_doctors.clinic_site_id', '=', target.clinicSiteId)
            .where('hps.email', 'is not', null)
            .execute()
        for (const row of doctors) {
            const email = emailFromUnknown(row.email)
            if (email !== undefined) {
                addresses.add(email)
            }
        }
    }

    if (target.facilityId !== null) {
        const facility = await db.selectFrom('facilities')
            .select('contact')
            .where('id', '=', target.facilityId)
            .executeTakeFirst()
        const contact = facility?.contact
        if (contact !== null && contact !== undefined && typeof contact === 'object') {
            const email = emailFromUnknown((contact as { email?: unknown }).email)
            if (email !== undefined) {
                addresses.add(email)
            }
        }

        const linked = await db.selectFrom('hps_facilities')
            .innerJoin('hps', 'hps.id', 'hps_facilities.hps_id')
            .select('hps.email')
            .where('hps_facilities.facilities_id', '=', target.facilityId)
            .where('hps.email', 'is not', null)
            .execute()
        for (const row of linked) {
            const email = emailFromUnknown(row.email)
            if (email !== undefined) {
                addresses.add(email)
            }
        }
    }

    return [...addresses]
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
