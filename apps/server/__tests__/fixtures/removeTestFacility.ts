import { db } from '../../src/kyselyClient.js'

/**
 * Removes a facility a test created, with the clinic setup rows that point at it.
 * The API no longer deletes facilities (they are archived), so tests clean up directly.
 * hps_facilities links cascade. A facility with booking requests is left for the caller.
 */
export async function removeTestFacility(facilityId: string): Promise<void> {
    await db.deleteFrom('booking_settings').where('facility_id', '=', facilityId).execute()
    await db.deleteFrom('booking_payment_settings').where('facility_id', '=', facilityId).execute()
    await db.deleteFrom('clinic_availability_windows').where('facility_id', '=', facilityId).execute()
    await db.deleteFrom('facilities').where('id', '=', facilityId).execute()
}
