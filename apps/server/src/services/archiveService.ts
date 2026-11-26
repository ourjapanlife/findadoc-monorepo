import * as gqlTypes from '@findadoc/graphql'
import type { Transaction } from 'kysely'
import { db } from '../kyselyClient.js'
import { ErrorCode, type Result } from '../result.js'
import { logger, errorLogFields } from '../logger.js'
import { createAuditLog } from './auditLogServiceSupabase.js'
import { lockClinicBookings } from '../booking/target.js'
import { validateArchiveId, validateArchiveInput } from '../validation/validateArchive.js'
import { facilityWithProfessionalIds, professionalWithFacilityIds } from './mappersEntityService.js'
import type { Database } from '../typeDefs/kyselyTypes.js'
import type { FacilityParent, ProfessionalParent } from '../typeDefs/resolverParents.js'

// Moderators archive a facility or a professional instead of deleting it. The row, its
// hps_facilities links, its bookings, and its institution_import_rows all stay. Public reads
// leave archived rows out in the query (see ARCHIVE_FILTER and the services that read them).

/** Appointment statuses that still hold a visit. A facility with one in the future is not archived. */
const OPEN_APPOINTMENT_STATUSES = ['requested', 'confirmed']

/** An expected refusal inside an archive transaction. The transaction rolls back and the code goes back. */
class ArchiveRefused extends Error {
    constructor(readonly errorCode: ErrorCode, readonly httpStatus: number, readonly count?: number) {
        super(errorCode)
    }
}

function refusedResult<T>(field: string, error: ArchiveRefused): Result<T> {
    return {
        data: {} as T,
        hasErrors: true,
        errors: [{
            field,
            errorCode: error.errorCode,
            httpStatus: error.httpStatus,
            ...(error.count === undefined ? {} : { count: error.count })
        }]
    }
}

function failedResult<T>(errors: Result<unknown>['errors']): Result<T> {
    return { data: {} as T, hasErrors: true, errors }
}

function serverErrorResult<T>(field: string): Result<T> {
    return failedResult([{ field, errorCode: ErrorCode.INTERNAL_SERVER_ERROR, httpStatus: 500 }])
}

/**
 * Requested or confirmed visits at the facility that have not ended. Archiving hides the
 * clinic from patients, so it waits until the clinic has answered or held these (#169).
 * Past bookings do not block: nothing is deleted, so their records stay.
 */
async function countUpcomingAppointments(transaction: Transaction<Database>, facilityId: string): Promise<number> {
    const row = await transaction.selectFrom('booking_appointments')
        .select(eb => eb.fn.countAll<string>().as('count'))
        .where('facility_id', '=', facilityId)
        .where('status', 'in', OPEN_APPOINTMENT_STATUSES)
        .where('ends_at', '>', new Date().toISOString())
        .executeTakeFirst()

    return Number(row?.count ?? 0)
}

async function professionalIdsFor(transaction: Transaction<Database>, facilityId: string): Promise<string[]> {
    const rows = await transaction.selectFrom('hps_facilities')
        .select('hps_id')
        .where('facilities_id', '=', facilityId)
        .execute()

    return rows.map(row => row.hps_id)
}

async function facilityIdsFor(transaction: Transaction<Database>, hpId: string): Promise<string[]> {
    const rows = await transaction.selectFrom('hps_facilities')
        .select('facilities_id')
        .where('hps_id', '=', hpId)
        .execute()

    return rows.map(row => row.facilities_id)
}

type ArchiveChange = { archive: true, reason: string } | { archive: false }

function archiveColumns(change: ArchiveChange, updatedBy: string) {
    return change.archive
        ? { archived_at: new Date().toISOString(), archived_reason: change.reason, archived_by: updatedBy }
        : { archived_at: null, archived_reason: null, archived_by: null }
}

/**
 * Archives or unarchives one facility. The write is a compare-and-set on archived_at, so two
 * moderators cannot both archive it. It takes the clinic's booking lock, so a booking submitted
 * at the same time either lands first (and blocks the archive) or sees the archived clinic.
 */
async function setFacilityArchive(
    id: string,
    change: ArchiveChange,
    updatedBy: string
): Promise<FacilityParent> {
    return db.transaction().execute(async transaction => {
        await lockClinicBookings(transaction, id)

        const existing = await transaction.selectFrom('facilities')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        if (existing === undefined) {
            throw new ArchiveRefused(ErrorCode.NOT_FOUND, 404)
        }

        if (change.archive) {
            const upcoming = await countUpcomingAppointments(transaction, id)

            if (upcoming > 0) {
                throw new ArchiveRefused(ErrorCode.FACILITY_HAS_UPCOMING_BOOKINGS, 409, upcoming)
            }
        }

        const updated = await transaction.updateTable('facilities')
            .set({ ...archiveColumns(change, updatedBy), updated_date: new Date().toISOString() })
            .where('id', '=', id)
            .where('archived_at', change.archive ? 'is' : 'is not', null)
            .returningAll()
            .executeTakeFirst()

        if (updated === undefined) {
            throw change.archive
                ? new ArchiveRefused(ErrorCode.ALREADY_ARCHIVED, 409)
                : new ArchiveRefused(ErrorCode.NOT_ARCHIVED, 409)
        }

        const professionalIds = await professionalIdsFor(transaction, id)
        const result = facilityWithProfessionalIds(updated, professionalIds)

        await createAuditLog(transaction, {
            actionType: gqlTypes.ActionType.Update,
            objectType: gqlTypes.ObjectType.Facility,
            updatedBy,
            oldValue: facilityWithProfessionalIds(existing, professionalIds),
            newValue: result
        })

        return result
    })
}

async function setProfessionalArchive(
    id: string,
    change: ArchiveChange,
    updatedBy: string
): Promise<ProfessionalParent> {
    return db.transaction().execute(async transaction => {
        const existing = await transaction.selectFrom('hps')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        if (existing === undefined) {
            throw new ArchiveRefused(ErrorCode.NOT_FOUND, 404)
        }

        const updated = await transaction.updateTable('hps')
            .set({ ...archiveColumns(change, updatedBy), updated_date: new Date().toISOString() })
            .where('id', '=', id)
            .where('archived_at', change.archive ? 'is' : 'is not', null)
            .returningAll()
            .executeTakeFirst()

        if (updated === undefined) {
            throw change.archive
                ? new ArchiveRefused(ErrorCode.ALREADY_ARCHIVED, 409)
                : new ArchiveRefused(ErrorCode.NOT_ARCHIVED, 409)
        }

        const facilityIds = await facilityIdsFor(transaction, id)
        const result = professionalWithFacilityIds(updated, facilityIds)

        await createAuditLog(transaction, {
            actionType: gqlTypes.ActionType.Update,
            objectType: gqlTypes.ObjectType.HealthcareProfessional,
            updatedBy,
            oldValue: professionalWithFacilityIds(existing, facilityIds),
            newValue: result
        })

        return result
    })
}

async function runArchive<T>(field: string, id: string, write: () => Promise<T>): Promise<Result<T>> {
    try {
        const data = await write()

        logger.info(`${field}: ${id} done`)
        return { data, hasErrors: false }
    } catch (error) {
        if (error instanceof ArchiveRefused) {
            logger.warn(`${field}: ${id} refused`, { errorCode: error.errorCode })
            return refusedResult(field, error)
        }

        logger.error(`${field}: ${id} failed`, errorLogFields(error))
        return serverErrorResult(field)
    }
}

/**
 * Hides a facility from the public and from booking, with the moderator's reason. Nothing is
 * deleted: professional links, bookings, and import rows stay, and unarchiveFacility undoes it.
 * The reason is not logged.
 */
export async function archiveFacility(
    id: string,
    reason: string,
    updatedBy: string
): Promise<Result<FacilityParent>> {
    const validation = validateArchiveInput(id, reason)

    if (validation.hasErrors) {
        return failedResult(validation.errors)
    }

    return runArchive('archiveFacility', id, () =>
        setFacilityArchive(id, { archive: true, reason: reason.trim() }, updatedBy))
}

/** Brings an archived facility back to the public and clears its archive reason. */
export async function unarchiveFacility(id: string, updatedBy: string): Promise<Result<FacilityParent>> {
    const validation = validateArchiveId(id)

    if (validation.hasErrors) {
        return failedResult(validation.errors)
    }

    return runArchive('unarchiveFacility', id, () => setFacilityArchive(id, { archive: false }, updatedBy))
}

/**
 * Hides a professional from the public, with the moderator's reason. Their facility links stay,
 * and unarchiveHealthcareProfessional undoes it. The reason is not logged.
 */
export async function archiveHealthcareProfessional(
    id: string,
    reason: string,
    updatedBy: string
): Promise<Result<ProfessionalParent>> {
    const validation = validateArchiveInput(id, reason)

    if (validation.hasErrors) {
        return failedResult(validation.errors)
    }

    return runArchive('archiveHealthcareProfessional', id, () =>
        setProfessionalArchive(id, { archive: true, reason: reason.trim() }, updatedBy))
}

/** Brings an archived professional back to the public and clears the archive reason. */
export async function unarchiveHealthcareProfessional(
    id: string,
    updatedBy: string
): Promise<Result<ProfessionalParent>> {
    const validation = validateArchiveId(id)

    if (validation.hasErrors) {
        return failedResult(validation.errors)
    }

    return runArchive('unarchiveHealthcareProfessional', id, () =>
        setProfessionalArchive(id, { archive: false }, updatedBy))
}
