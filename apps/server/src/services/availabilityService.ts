import type {
    ClinicAvailabilityClosure,
    ClinicAvailabilityWindow,
    ClinicWeeklyHours,
    CreateClinicAvailabilityClosureInput,
    CreateClinicAvailabilityWindowInput,
    DeleteResult,
    SetClinicWeeklyHoursInput
} from '@findadoc/graphql'
import { randomUUID } from 'node:crypto'
import { canWriteFacility, type BookingAccess } from '../booking/access.js'
import { resolveBookingTarget } from '../booking/target.js'
import {
    assertAvailabilityRange,
    isWeeklyHours,
    normalizeWeeklyHours,
    snapDownToAvailability,
    snapUpToAvailability
} from '../booking/schedule.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'

function validationError(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
    }
}

/** Longest range one calendar read may ask for. A month view is about 42 days. */
export const MAX_STAFF_CALENDAR_RANGE_MS = 62 * 24 * 60 * 60 * 1000

export function isStaffCalendarRange(from: Date, to: Date): boolean {
    return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from
        && to.getTime() - from.getTime() <= MAX_STAFF_CALENDAR_RANGE_MS
}

export async function listClinicAvailabilityWindows(
    clinicIdOrSlug: string,
    fromIso: string,
    toIso: string,
    access: BookingAccess
): Promise<ClinicAvailabilityWindow[]> {
    const target = await resolveBookingTarget(clinicIdOrSlug)
    if (target === undefined || !canWriteFacility(access, target.facilityId)) {
        return []
    }
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (!isStaffCalendarRange(from, to)) {
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
    createdBy: string | undefined,
    access: BookingAccess
): Promise<Result<ClinicAvailabilityWindow>> {
    const target = await resolveBookingTarget(input.clinicSiteId)
    if (target === undefined || !canWriteFacility(access, target.facilityId)) {
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

export async function deleteClinicAvailabilityWindow(
    id: string,
    access: BookingAccess
): Promise<Result<DeleteResult>> {
    const window = await db.selectFrom('clinic_availability_windows')
        .select('facility_id')
        .where('id', '=', id)
        .executeTakeFirst()
    if (window === undefined || !canWriteFacility(access, window.facility_id)) {
        return { data: { isSuccessful: false }, hasErrors: false }
    }

    const result = await db.deleteFrom('clinic_availability_windows')
        .where('id', '=', id)
        .executeTakeFirst()

    const deleted = Number(result.numDeletedRows ?? 0) > 0
    return {
        data: { isSuccessful: deleted },
        hasErrors: false
    }
}

/** More blocks than any real week needs. Two blocks a day is 14. */
export const MAX_WEEKLY_HOUR_BLOCKS = 50
const MAX_CLOSURE_REASON_LENGTH = 200

/** The facility a staff call may change, or undefined when the user may not. */
async function writableFacilityId(clinicId: string, access: BookingAccess): Promise<string | undefined> {
    const target = await resolveBookingTarget(clinicId)
    if (target === undefined || target.facilityId === null || !canWriteFacility(access, target.facilityId)) {
        return undefined
    }
    return target.facilityId
}

function weeklyHoursFromRow(row: {
    id: string
    facility_id: string
    weekday: number
    start_minute: number
    end_minute: number
}): ClinicWeeklyHours {
    return {
        id: row.id,
        facilityId: row.facility_id,
        weekday: row.weekday,
        startMinute: row.start_minute,
        endMinute: row.end_minute
    }
}

function closureFromRow(row: {
    id: string
    facility_id: string
    starts_at: string
    ends_at: string
    reason: string | null
    created_date: string
}): ClinicAvailabilityClosure {
    return {
        id: row.id,
        facilityId: row.facility_id,
        startsAt: new Date(row.starts_at).toISOString(),
        endsAt: new Date(row.ends_at).toISOString(),
        reason: row.reason,
        createdDate: row.created_date
    }
}

const WEEKLY_HOURS_COLUMNS = ['id', 'facility_id', 'weekday', 'start_minute', 'end_minute'] as const
const CLOSURE_COLUMNS = ['id', 'facility_id', 'starts_at', 'ends_at', 'reason', 'created_date'] as const

export async function listClinicWeeklyHours(clinicId: string, access: BookingAccess): Promise<ClinicWeeklyHours[]> {
    const facilityId = await writableFacilityId(clinicId, access)
    if (facilityId === undefined) {
        return []
    }
    const rows = await db.selectFrom('clinic_weekly_hours')
        .select(WEEKLY_HOURS_COLUMNS)
        .where('facility_id', '=', facilityId)
        .orderBy('weekday')
        .orderBy('start_minute')
        .execute()
    return rows.map(weeklyHoursFromRow)
}

/** Replaces the clinic's whole week. Blocks that overlap or touch on one day are joined. */
export async function setClinicWeeklyHours(
    input: SetClinicWeeklyHoursInput,
    createdBy: string | undefined,
    access: BookingAccess
): Promise<Result<ClinicWeeklyHours[]>> {
    const facilityId = await writableFacilityId(input.facilityId, access)
    if (facilityId === undefined) {
        return validationError('facilityId')
    }
    if (input.hours.length > MAX_WEEKLY_HOUR_BLOCKS || !input.hours.every(isWeeklyHours)) {
        return validationError('hours')
    }
    const hours = normalizeWeeklyHours(input.hours)

    const rows = await db.transaction().execute(async transaction => {
        await transaction.deleteFrom('clinic_weekly_hours')
            .where('facility_id', '=', facilityId)
            .execute()
        if (hours.length === 0) {
            return []
        }
        return transaction.insertInto('clinic_weekly_hours')
            .values(hours.map(block => ({
                facility_id: facilityId,
                weekday: block.weekday,
                start_minute: block.startMinute,
                end_minute: block.endMinute,
                created_by: createdBy ?? null
            })))
            .returning(WEEKLY_HOURS_COLUMNS)
            .execute()
    })

    return { data: rows.map(weeklyHoursFromRow), hasErrors: false }
}

export async function listClinicAvailabilityClosures(
    clinicId: string,
    fromIso: string,
    toIso: string,
    access: BookingAccess
): Promise<ClinicAvailabilityClosure[]> {
    const facilityId = await writableFacilityId(clinicId, access)
    const from = new Date(fromIso)
    const to = new Date(toIso)
    if (facilityId === undefined || !isStaffCalendarRange(from, to)) {
        return []
    }
    const rows = await db.selectFrom('clinic_availability_closures')
        .select(CLOSURE_COLUMNS)
        .where('facility_id', '=', facilityId)
        .where('starts_at', '<', to.toISOString())
        .where('ends_at', '>', from.toISOString())
        .orderBy('starts_at')
        .execute()
    return rows.map(closureFromRow)
}

/** Closes a range on the calendar. Appointments already in it stay; nothing new is offered there. */
export async function createClinicAvailabilityClosure(
    input: CreateClinicAvailabilityClosureInput,
    createdBy: string | undefined,
    access: BookingAccess
): Promise<Result<ClinicAvailabilityClosure>> {
    const facilityId = await writableFacilityId(input.clinicId, access)
    if (facilityId === undefined) {
        return validationError('clinicId')
    }
    const rawStart = new Date(input.startsAt)
    const rawEnd = new Date(input.endsAt)
    if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) {
        return validationError('startsAt')
    }
    const startsAt = snapDownToAvailability(rawStart)
    const endsAt = snapUpToAvailability(rawEnd)
    if (!isStaffCalendarRange(startsAt, endsAt)) {
        return validationError('endsAt')
    }
    const reason = input.reason?.trim() || null
    if (reason !== null && reason.length > MAX_CLOSURE_REASON_LENGTH) {
        return validationError('reason')
    }

    const row = await db.insertInto('clinic_availability_closures')
        .values({
            facility_id: facilityId,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            reason,
            created_by: createdBy ?? null
        })
        .returning(CLOSURE_COLUMNS)
        .executeTakeFirstOrThrow()

    return { data: closureFromRow(row), hasErrors: false }
}

export async function deleteClinicAvailabilityClosure(
    id: string,
    access: BookingAccess
): Promise<Result<DeleteResult>> {
    const closure = await db.selectFrom('clinic_availability_closures')
        .select('facility_id')
        .where('id', '=', id)
        .executeTakeFirst()
    if (closure === undefined || !canWriteFacility(access, closure.facility_id)) {
        return { data: { isSuccessful: false }, hasErrors: false }
    }
    const result = await db.deleteFrom('clinic_availability_closures')
        .where('id', '=', id)
        .executeTakeFirst()
    return { data: { isSuccessful: Number(result.numDeletedRows ?? 0) > 0 }, hasErrors: false }
}
