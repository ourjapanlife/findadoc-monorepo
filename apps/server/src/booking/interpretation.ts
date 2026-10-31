import type { BookingAccess } from './access.js'
import { db } from '../kyselyClient.js'

/**
 * Clinic interpretation (#205): with it on, every language the clinic lists is
 * available with every doctor, so a language choice does not narrow the doctors
 * or schedules. A booking_interpretation row means the clinic offers it.
 *
 * It is meant to be a paid add-on, so a clinic member cannot turn it on or off.
 * canChangeInterpretation is the one gate; billing hooks in there.
 */

export const INTERPRETATION_SOURCE = {
    PILOT: 'pilot',
    ADMIN: 'admin'
} as const

/** Who may turn interpretation on or off: admins only, until there is a plan to check. */
export function canChangeInterpretation(access: BookingAccess): boolean {
    return access.manageMembersAll
}

export async function offersInterpretation(facilityId: string | null): Promise<boolean> {
    if (facilityId === null) {
        return false
    }
    const row = await db.selectFrom('booking_interpretation')
        .select('facility_id')
        .where('facility_id', '=', facilityId)
        .executeTakeFirst()
    return row !== undefined
}

/** Turns interpretation on or off. Callers check canChangeInterpretation first. */
export async function setInterpretation(facilityId: string, enabled: boolean): Promise<void> {
    if (!enabled) {
        await db.deleteFrom('booking_interpretation').where('facility_id', '=', facilityId).execute()
        return
    }
    await db.insertInto('booking_interpretation')
        .values({ facility_id: facilityId, source: INTERPRETATION_SOURCE.ADMIN })
        .onConflict(conflict => conflict.column('facility_id').doNothing())
        .execute()
}
