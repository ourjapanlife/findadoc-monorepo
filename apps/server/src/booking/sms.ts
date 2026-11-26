import type { BookingAccess } from './access.js'
import { lockClinicBookings } from './target.js'
import { db } from '../kyselyClient.js'

/**
 * SMS as the patient's contact channel (#206).
 *
 * booking_sms says a clinic's patients may choose SMS instead of email. SMS is meant
 * to be a paid add-on, so canChangeSms is the one gate and billing hooks in there.
 * The phone answer is required on every request; with SMS the email answer is not.
 */

export const SMS_SOURCE = {
    PILOT: 'pilot',
    ADMIN: 'admin'
} as const

/** How the patient asked to hear back, as stored in booking_submissions.contact_channel. */
export const CONTACT_CHANNEL = {
    EMAIL: 'email',
    SMS: 'sms'
} as const

export type ContactChannel = typeof CONTACT_CHANNEL[keyof typeof CONTACT_CHANNEL]

export function isContactChannel(value: unknown): value is ContactChannel {
    return value === CONTACT_CHANNEL.EMAIL || value === CONTACT_CHANNEL.SMS
}

type Executor = Pick<typeof db, 'selectFrom'>

/** Who may turn SMS on or off: admins only, until there is a plan to check. */
export function canChangeSms(access: BookingAccess): boolean {
    return access.isAdmin
}

export async function offersSms(facilityId: string | null, executor: Executor = db): Promise<boolean> {
    if (facilityId === null) {
        return false
    }
    const row = await executor.selectFrom('booking_sms')
        .select('facility_id')
        .where('facility_id', '=', facilityId)
        .executeTakeFirst()
    return row !== undefined
}

/**
 * Turns SMS on or off. Callers check canChangeSms first. It holds the clinic's booking
 * lock, so a submit that reads offersSms in its transaction sees the change before or after.
 */
export async function setSms(facilityId: string, enabled: boolean): Promise<void> {
    await db.transaction().execute(async transaction => {
        await lockClinicBookings(transaction, facilityId)
        if (!enabled) {
            await transaction.deleteFrom('booking_sms').where('facility_id', '=', facilityId).execute()
            return
        }
        await transaction.insertInto('booking_sms')
            .values({ facility_id: facilityId, source: SMS_SOURCE.ADMIN })
            .onConflict(conflict => conflict.column('facility_id').doNothing())
            .execute()
    })
}
