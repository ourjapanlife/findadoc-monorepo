import type {
    ClinicAvailabilityWindow,
    CreateClinicAvailabilityWindowInput,
    DeleteResult
} from '@findadoc/graphql'
import { randomUUID } from 'node:crypto'
import { assertAvailabilityRange, snapDownToAvailability, snapUpToAvailability } from '../booking/schedule.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveClinicSiteId(clinicSiteIdOrSlug: string): Promise<string | undefined> {
    const trimmed = clinicSiteIdOrSlug.trim()
    if (UUID_PATTERN.test(trimmed)) {
        const row = await db.selectFrom('clinic_sites')
            .select('id')
            .where('id', '=', trimmed)
            .where('status', '!=', 'draft')
            .executeTakeFirst()
        return row?.id
    }
    if (!SLUG_PATTERN.test(trimmed)) {
        return undefined
    }
    const row = await db.selectFrom('clinic_sites')
        .select('id')
        .where('slug', '=', trimmed)
        .where('status', '!=', 'draft')
        .executeTakeFirst()
    return row?.id
}

function validationError(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
    }
}

export async function listClinicAvailabilityWindows(
    clinicSiteIdOrSlug: string,
    fromIso: string,
    toIso: string
): Promise<ClinicAvailabilityWindow[]> {
    const clinicSiteId = await resolveClinicSiteId(clinicSiteIdOrSlug)
    if (clinicSiteId === undefined) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !(to > from)) {
        return []
    }

    const rows = await db.selectFrom('clinic_availability_windows')
        .select(['id', 'clinic_site_id', 'starts_at', 'ends_at', 'created_date'])
        .where('clinic_site_id', '=', clinicSiteId)
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
        .orderBy('starts_at')
        .execute()

    return rows.map(row => ({
        id: row.id,
        clinicSiteId: row.clinic_site_id,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        createdDate: row.created_date
    }))
}

export async function createClinicAvailabilityWindow(
    input: CreateClinicAvailabilityWindowInput,
    createdBy: string | undefined
): Promise<Result<ClinicAvailabilityWindow>> {
    const clinicSiteId = await resolveClinicSiteId(input.clinicSiteId)
    if (clinicSiteId === undefined) {
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
            clinic_site_id: clinicSiteId,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            created_by: createdBy ?? null
        })
        .returning(['id', 'clinic_site_id', 'starts_at', 'ends_at', 'created_date'])
        .executeTakeFirstOrThrow()

    return {
        data: {
            id: row.id,
            clinicSiteId: row.clinic_site_id,
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
