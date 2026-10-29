import type {
    ClinicAvailabilityWindow,
    CreateClinicAvailabilityWindowInput,
    DeleteResult
} from '@findadoc/graphql'
import { randomUUID } from 'node:crypto'
import { resolveBookingTarget } from '../booking/target.js'
import { assertAvailabilityRange, snapDownToAvailability, snapUpToAvailability } from '../booking/schedule.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'

function validationError(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
    }
}

export async function listClinicAvailabilityWindows(
    clinicIdOrSlug: string,
    fromIso: string,
    toIso: string
): Promise<ClinicAvailabilityWindow[]> {
    const target = await resolveBookingTarget(clinicIdOrSlug)
    if (target === undefined) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !(to > from)) {
        return []
    }

    let query = db.selectFrom('clinic_availability_windows')
        .select(['id', 'clinic_site_id', 'facility_id', 'starts_at', 'ends_at', 'created_date'])
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
        .orderBy('starts_at')

    if (target.facilityId !== null) {
        query = query.where('facility_id', '=', target.facilityId)
    } else if (target.clinicSiteId !== null) {
        query = query.where('clinic_site_id', '=', target.clinicSiteId)
    } else {
        return []
    }

    const rows = await query.execute()

    return rows.map(row => ({
        id: row.id,
        clinicSiteId: row.clinic_site_id,
        facilityId: row.facility_id,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        createdDate: row.created_date
    }))
}

export async function createClinicAvailabilityWindow(
    input: CreateClinicAvailabilityWindowInput,
    createdBy: string | undefined
): Promise<Result<ClinicAvailabilityWindow>> {
    const target = await resolveBookingTarget(input.clinicSiteId)
    if (target === undefined) {
        return validationError('clinicSiteId')
    }

    const rawStart = new Date(input.startsAt)
    const rawEnd = new Date(input.endsAt)
    if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) {
        return validationError('startsAt')
    }

    const startsAt = snapDownToAvailability(rawStart)
    const endsAt = snapUpToAvailability(rawEnd)
    try {
        assertAvailabilityRange(startsAt, endsAt)
    } catch {
        return validationError('startsAt')
    }

    const id = randomUUID()
    const row = await db.insertInto('clinic_availability_windows')
        .values({
            id,
            facility_id: target.facilityId,
            clinic_site_id: target.clinicSiteId,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            created_by: createdBy ?? null
        })
        .returning(['id', 'clinic_site_id', 'facility_id', 'starts_at', 'ends_at', 'created_date'])
        .executeTakeFirstOrThrow()

    return {
        data: {
            id: row.id,
            clinicSiteId: row.clinic_site_id,
            facilityId: row.facility_id,
            startsAt: new Date(row.starts_at).toISOString(),
            endsAt: new Date(row.ends_at).toISOString(),
            createdDate: row.created_date
        },
        hasErrors: false
    }
}

export async function deleteClinicAvailabilityWindow(id: string): Promise<Result<DeleteResult>> {
    const result = await db.deleteFrom('clinic_availability_windows')
        .where('id', '=', id)
        .executeTakeFirst()

    const deleted = Number(result.numDeletedRows ?? 0) > 0
    return {
        data: { isSuccessful: deleted },
        hasErrors: false
    }
}
