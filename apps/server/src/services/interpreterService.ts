import type { ClinicInterpreter, DeleteResult, Locale, SaveClinicInterpreterInput } from '@findadoc/graphql'
import { canManageFacility, canReadFacility, type BookingAccess } from '../booking/access.js'
import { listInterpreters, type Interpreter } from '../booking/interpretation.js'
import { SLOT_HOLDING_STATUSES } from '../booking/lifecycle.js'
import { sql } from 'kysely'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'
import { ErrorCode, Result } from '../result.js'
import { UUID_REGEX } from '../validation/validateFacility.js'
import { validateClinicInterpreter } from '../validation/validateClinicInterpreter.js'

/**
 * A clinic's interpreters (#205, docs/booking-interpretation.md). Owners and admins
 * change them; staff read them. They only reach patients while the clinic has
 * interpretation on, which only an admin changes (booking/interpretation.ts).
 */

function failure(field: string, errorCode: ErrorCode, httpStatus: number): Result<never> {
    return { data: undefined as never, hasErrors: true, errors: [{ field, errorCode, httpStatus }] }
}

function toGql(facilityId: string, interpreter: Interpreter): ClinicInterpreter {
    return {
        id: interpreter.id,
        facilityId,
        label: interpreter.label,
        languages: interpreter.languages as Locale[] | null,
        capacity: interpreter.capacity,
        hours: interpreter.hours
    }
}

export async function listClinicInterpreters(facilityId: string, access: BookingAccess): Promise<ClinicInterpreter[]> {
    if (!canReadFacility(access, facilityId)) {
        return []
    }
    const interpreters = await listInterpreters(facilityId)
    return interpreters.map(interpreter => toGql(facilityId, interpreter))
}

/** Adds an interpreter, or replaces one's fields and whole week. */
export async function saveClinicInterpreter(
    input: SaveClinicInterpreterInput,
    access: BookingAccess
): Promise<Result<ClinicInterpreter>> {
    const checked = validateClinicInterpreter(input)
    if ('field' in checked) {
        return failure(checked.field, ErrorCode.INVALID_INPUT, 400)
    }
    const value = checked.value
    if (!canManageFacility(access, value.facilityId)) {
        return failure('facilityId', ErrorCode.FORBIDDEN, 403)
    }
    const facility = await db.selectFrom('facilities').select('id').where('id', '=', value.facilityId).executeTakeFirst()
    if (facility === undefined) {
        return failure('facilityId', ErrorCode.INVALID_INPUT, 400)
    }

    try {
        const savedId = await db.transaction().execute(async transaction => {
            let id = value.id
            if (id === null) {
                const row = await transaction.insertInto('clinic_interpreters')
                    .values({
                        facility_id: value.facilityId,
                        label: value.label,
                        languages: value.languages,
                        capacity: value.capacity
                    })
                    .returning('id')
                    .executeTakeFirstOrThrow()
                id = row.id
            } else {
                // The facility filter keeps an owner to their own clinic's rows.
                const updated = await transaction.updateTable('clinic_interpreters')
                    .set({
                        label: value.label,
                        languages: value.languages,
                        capacity: value.capacity,
                        updated_date: sql`now()`
                    })
                    .where('id', '=', id)
                    .where('facility_id', '=', value.facilityId)
                    .executeTakeFirst()
                if (Number(updated.numUpdatedRows) === 0) {
                    return undefined
                }
                await transaction.deleteFrom('clinic_interpreter_hours').where('interpreter_id', '=', id).execute()
            }
            if (value.hours.length > 0) {
                const interpreterId = id
                await transaction.insertInto('clinic_interpreter_hours')
                    .values(value.hours.map(block => ({
                        interpreter_id: interpreterId,
                        weekday: block.weekday,
                        start_minute: block.startMinute,
                        end_minute: block.endMinute
                    })))
                    .execute()
            }
            return id
        })
        if (savedId === undefined) {
            return failure('id', ErrorCode.NOT_FOUND, 404)
        }
        const saved = (await listInterpreters(value.facilityId)).find(interpreter => interpreter.id === savedId)
        if (saved === undefined) {
            return failure('id', ErrorCode.NOT_FOUND, 404)
        }
        return { data: toGql(value.facilityId, saved), hasErrors: false }
    } catch (error) {
        logger.error(`saveClinicInterpreter failed: ${error instanceof Error ? error.name : 'unknown'}`)
        return failure('input', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }
}

/**
 * Removes an interpreter. Refused while an upcoming held visit uses them; past
 * visits keep a null. It takes the clinic's booking lock, as submit does, so a
 * visit cannot take this interpreter between the check and the delete.
 */
export async function deleteClinicInterpreter(id: string, access: BookingAccess): Promise<Result<DeleteResult>> {
    if (!UUID_REGEX.test(id)) {
        return failure('id', ErrorCode.INVALID_ID, 400)
    }
    const row = await db.selectFrom('clinic_interpreters')
        .select(['id', 'facility_id'])
        .where('id', '=', id)
        .executeTakeFirst()
    if (row === undefined) {
        return { data: { isSuccessful: false }, hasErrors: false }
    }
    if (!canManageFacility(access, row.facility_id)) {
        return failure('id', ErrorCode.FORBIDDEN, 403)
    }
    const outcome = await db.transaction().execute(async transaction => {
        await sql`SELECT pg_advisory_xact_lock(hashtext(${row.facility_id}))`.execute(transaction)
        const upcoming = await transaction.selectFrom('booking_appointments')
            .select('id')
            .where('interpreter_id', '=', id)
            .where('status', 'in', SLOT_HOLDING_STATUSES)
            .where('ends_at', '>', new Date().toISOString())
            .executeTakeFirst()
        if (upcoming !== undefined) {
            return 'held' as const
        }
        const deleted = await transaction.deleteFrom('clinic_interpreters')
            .where('id', '=', id)
            .where('facility_id', '=', row.facility_id)
            .executeTakeFirst()
        return Number(deleted.numDeletedRows) > 0
    })
    if (outcome === 'held') {
        return failure('id', ErrorCode.INTERPRETER_HAS_BOOKINGS, 409)
    }
    return { data: { isSuccessful: outcome }, hasErrors: false }
}
